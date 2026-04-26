using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ClosedXML.Excel;
using CPS.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace CPS.API.Services
{
    public interface IMasterImportJobProcessor
    {
        Task ProcessJobAsync(int jobId, CancellationToken ct);
    }

    public class MasterImportJobProcessor : IMasterImportJobProcessor
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MasterImportJobProcessor> _logger;

        public MasterImportJobProcessor(IServiceProvider serviceProvider, ILogger<MasterImportJobProcessor> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task ProcessJobAsync(int jobId, CancellationToken ct)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CpsDbContext>();
            
            var job = await db.Jobs.FindAsync(jobId);
            if (job == null) return;

            try
            {
                job.Status = JobStatus.Processing;
                job.StartedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();

                string filePath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Masters", job.FileName);
                if (!File.Exists(filePath))
                {
                    throw new FileNotFoundException("Upload file not found on server.", filePath);
                }

                if (job.JobType == "Location")
                {
                    await ProcessLocationImportAsync(job, filePath, db, ct);
                }
                else if (job.JobType == "Client")
                {
                    await ProcessClientImportAsync(job, filePath, db, ct);
                }
                else if (job.JobType == "internal-bank")
                {
                    await ProcessInternalBankImportAsync(job, filePath, db, ct);
                }
                else if (job.JobType == "capture-rule")
                {
                    await ProcessCaptureRuleImportAsync(job, filePath, db, ct);
                }
                else if (job.JobType == "scb-master")
                {
                    await ProcessScbMasterImportAsync(job, filePath, scope.ServiceProvider, ct);
                }
                // Add other master types here...
                
                job.Status = JobStatus.Completed;
                job.CompletedAt = DateTime.UtcNow;
                job.ProgressPercent = 100;
            }
            catch (OperationCanceledException)
            {
                job.Status = JobStatus.Cancelled;
                _logger.LogInformation($"Job {jobId} was cancelled.");
            }
            catch (Exception ex)
            {
                job.Status = JobStatus.Failed;
                job.ErrorMessage = ex.Message;
                _logger.LogError(ex, $"Error processing job {jobId}");
            }
            finally
            {
                await db.SaveChangesAsync();
            }
        }

        private async Task ProcessLocationImportAsync(BackgroundJob job, string filePath, CpsDbContext db, CancellationToken ct)
        {
            using var workbook = new XLWorkbook(filePath);
            var worksheet = workbook.Worksheet(1);
            var range = worksheet.RangeUsed();
            if (range == null) return;
            var allRows = range.RowsUsed().ToList();
            if (allRows.Count < 2) return;

            var headerRow = allRows[0];
            var dataRows = allRows.Skip(1).ToList();

            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var lastCell = headerRow.LastCellUsed();
            if (lastCell != null)
            {
                for (int col = 1; col <= lastCell.Address.ColumnNumber; col++)
                {
                    var val = headerRow.Cell(col).GetString().Trim();
                    if (!string.IsNullOrEmpty(val)) headerMap[val] = col;
                }
            }
            
            job.TotalRows = dataRows.Count;
            int startRow = job.ProcessedRows;
            await db.SaveChangesAsync();

            var seenKeys = new HashSet<string>();

            const int chunkSize = 500;
            for (int i = startRow; i < dataRows.Count; i += chunkSize)
            {
                if (ct.IsCancellationRequested) throw new OperationCanceledException();
                
                var currentJob = await db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == job.Id);
                if (currentJob?.Status == JobStatus.Cancelled) throw new OperationCanceledException();

                var chunk = dataRows.Skip(i).Take(chunkSize).ToList();
                foreach (var row in chunk)
                {
                    try
                    {
                        var code = GetVal(row, headerMap, "Location Code") ?? GetVal(row, headerMap, "LocationCode");
                        if (string.IsNullOrWhiteSpace(code)) continue;

                        if (!seenKeys.Add(code))
                        {
                            throw new Exception($"Duplicate Location Code '{code}' in file. Skipped.");
                        }

                        var values = new Dictionary<string, string>
                        {
                            ["LocationCode"] = code,
                            ["LocationName"] = GetVal(row, headerMap, "LocationName") ?? "",
                            ["State"] = GetVal(row, headerMap, "State") ?? "",
                            ["Zone"] = GetVal(row, headerMap, "Zone") ?? ""
                        };

                        await UpsertLocationAsync(db, values, job.CreatedBy);
                        job.InsertedCount++; 
                    }
                    catch (Exception ex)
                    {
                        job.FailedCount++;
                        db.JobErrors.Add(new JobError
                        {
                            JobId = job.Id,
                            RowNumber = row.RowNumber(),
                            Message = ex.Message,
                            RawData = "Location Import"
                        });
                    }
                }

                job.ProcessedRows += chunk.Count;
                job.ProgressPercent = (int)((double)job.ProcessedRows / job.TotalRows * 100);
                try { await db.SaveChangesAsync(); }
                catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException) { throw new OperationCanceledException("Job deleted."); }
            }
        }

        private async Task ProcessClientImportAsync(BackgroundJob job, string filePath, CpsDbContext db, CancellationToken ct)
        {
            using var workbook = new XLWorkbook(filePath);
            var worksheet = workbook.Worksheet(1);
            var rows = worksheet.RangeUsed().RowsUsed().Skip(1).ToList();
            
            job.TotalRows = rows.Count;
            // Support resumption
            int startRow = job.ProcessedRows;
            await db.SaveChangesAsync();

            var seenKeys = new HashSet<string>();

            const int chunkSize = 500;
            for (int i = startRow; i < rows.Count; i += chunkSize)
            {
                if (ct.IsCancellationRequested) throw new OperationCanceledException();

                var currentJob = await db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == job.Id);
                if (currentJob?.Status == JobStatus.Cancelled) throw new OperationCanceledException();

                var chunk = rows.Skip(i).Take(chunkSize).ToList();
                foreach (var row in chunk)
                {
                    try
                    {
                        var values = GetRowValues(row, "Client");
                        var key = $"{values["CityCode"]}|{values["RCMSCode"]}|{values["PickupPointCode"]}";
                        if (!seenKeys.Add(key))
                        {
                            throw new Exception("Duplicate City/RCMS/Pickup combo in file. Skipped.");
                        }

                        await UpsertClientAsync(db, values, job.CreatedBy);
                        job.InsertedCount++;
                    }
                    catch (Exception ex)
                    {
                        job.FailedCount++;
                        db.JobErrors.Add(new JobError
                        {
                            JobId = job.Id,
                            RowNumber = row.RowNumber(),
                            Message = ex.Message,
                            RawData = JsonSerializer.Serialize(GetRowValues(row, "Client"))
                        });
                    }
                }

                job.ProcessedRows += chunk.Count;
                job.ProgressPercent = (int)((double)job.ProcessedRows / job.TotalRows * 100);
                try
                {
                    await db.SaveChangesAsync();
                }
                catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
                {
                    // The job was likely deleted from the database mid-processing. Abort gracefully.
                    throw new OperationCanceledException("Job was deleted from the database.");
                }
            }
        }

        private async Task ProcessInternalBankImportAsync(BackgroundJob job, string filePath, CpsDbContext db, CancellationToken ct)
        {
            using var workbook = new XLWorkbook(filePath);
            var worksheet = workbook.Worksheet(1);
            var range = worksheet.RangeUsed();
            if (range == null) return;
            var allRows = range.RowsUsed().ToList();
            if (allRows.Count < 2) return;

            var headerRow = allRows[0];
            var dataRows = allRows.Skip(1).ToList();

            // Map headers to indices
            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var lastCell = headerRow.LastCellUsed();
            if (lastCell != null)
            {
                for (int col = 1; col <= lastCell.Address.ColumnNumber; col++)
                {
                    var val = headerRow.Cell(col).GetString().Trim();
                    if (!string.IsNullOrEmpty(val)) headerMap[val] = col;
                }
            }

            job.TotalRows = dataRows.Count;
            int startRow = job.ProcessedRows;

            if (startRow == 0)
            {
                db.InternalBankMasters.RemoveRange(db.InternalBankMasters);
                await db.SaveChangesAsync();
            }

            const int chunkSize = 500;
            for (int i = startRow; i < dataRows.Count; i += chunkSize)
            {
                if (ct.IsCancellationRequested) throw new OperationCanceledException();
                var currentJob = await db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == job.Id);
                if (currentJob?.Status == JobStatus.Cancelled) throw new OperationCanceledException();

                var chunk = dataRows.Skip(i).Take(chunkSize).ToList();
                foreach (var row in chunk)
                {
                    try
                    {
                        var ebank = GetVal(row, headerMap, "EBANK");
                        var sortcode = GetVal(row, headerMap, "SORTCODE");
                        if (string.IsNullOrWhiteSpace(ebank) && string.IsNullOrWhiteSpace(sortcode)) continue;

                        db.InternalBankMasters.Add(new InternalBankMaster
                        {
                            EBANK = ebank,
                            SORTCODE = sortcode,
                            NAME = GetVal(row, headerMap, "NAME"),
                            FULLNAME = GetVal(row, headerMap, "FULLNAME"),
                            BRANCH = GetVal(row, headerMap, "BRANCH"),
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = job.CreatedBy
                        });
                        job.InsertedCount++;
                    }
                    catch (Exception ex)
                    {
                        job.FailedCount++;
                        db.JobErrors.Add(new JobError { JobId = job.Id, RowNumber = row.RowNumber(), Message = ex.Message });
                    }
                }

                job.ProcessedRows += chunk.Count;
                job.ProgressPercent = (int)((double)job.ProcessedRows / job.TotalRows * 100);
                try { await db.SaveChangesAsync(); }
                catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException) { throw new OperationCanceledException("Job deleted."); }
            }
        }

        private async Task ProcessCaptureRuleImportAsync(BackgroundJob job, string filePath, CpsDbContext db, CancellationToken ct)
        {
            using var workbook = new XLWorkbook(filePath);
            var worksheet = workbook.Worksheet(1);
            var range = worksheet.RangeUsed();
            if (range == null) return;
            var allRows = range.RowsUsed().ToList();
            if (allRows.Count < 2) return;

            var headerRow = allRows[0];
            var dataRows = allRows.Skip(1).ToList();

            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var lastCell = headerRow.LastCellUsed();
            if (lastCell != null)
            {
                for (int col = 1; col <= lastCell.Address.ColumnNumber; col++)
                {
                    var val = headerRow.Cell(col).GetString().Trim();
                    if (!string.IsNullOrEmpty(val)) headerMap[val] = col;
                }
            }

            job.TotalRows = dataRows.Count;
            int startRow = job.ProcessedRows;

            if (startRow == 0)
            {
                db.ClientCaptureRules.RemoveRange(db.ClientCaptureRules);
                await db.SaveChangesAsync();
            }

            const int chunkSize = 500;
            for (int i = startRow; i < dataRows.Count; i += chunkSize)
            {
                if (ct.IsCancellationRequested) throw new OperationCanceledException();
                var currentJob = await db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == job.Id);
                if (currentJob?.Status == JobStatus.Cancelled) throw new OperationCanceledException();

                var chunk = dataRows.Skip(i).Take(chunkSize).ToList();
                foreach (var row in chunk)
                {
                    try
                    {
                        var ceid = GetVal(row, headerMap, "CEID");
                        var clientCode = GetVal(row, headerMap, "ClientCode");
                        if (string.IsNullOrWhiteSpace(ceid) && string.IsNullOrWhiteSpace(clientCode)) continue;

                        db.ClientCaptureRules.Add(new ClientCaptureRule
                        {
                            CEID = ceid,
                            ClientCode = clientCode,
                            FieldName1 = GetVal(row, headerMap, "FieldName1"),
                            FieldName2 = GetVal(row, headerMap, "FieldName2"),
                            FieldName3 = GetVal(row, headerMap, "FieldName3"),
                            FieldName4 = GetVal(row, headerMap, "FieldName4"),
                            FieldName5 = GetVal(row, headerMap, "FieldName5"),
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = job.CreatedBy
                        });
                        job.InsertedCount++;
                    }
                    catch (Exception ex)
                    {
                        job.FailedCount++;
                        db.JobErrors.Add(new JobError { JobId = job.Id, RowNumber = row.RowNumber(), Message = ex.Message });
                    }
                }

                job.ProcessedRows += chunk.Count;
                job.ProgressPercent = (int)((double)job.ProcessedRows / job.TotalRows * 100);
                try { await db.SaveChangesAsync(); }
                catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException) { throw new OperationCanceledException("Job deleted."); }
            }
        }

        private string? GetVal(IXLRangeRow row, Dictionary<string, int> map, string key)
        {
            if (map.TryGetValue(key, out int col))
            {
                return row.Cell(col).GetString().Trim();
            }
            return null;
        }

        private Dictionary<string, string> GetRowValues(IXLRangeRow row, string type)
        {
            var dict = new Dictionary<string, string>();
            if (type == "Location")
            {
                // Headers: "SrNo", "Grid", "State", "LocationName", "Location Code", "Cluster CODE", "Zone", "ScannerID", "BOFD", "PreTrun", "DepositAc", "IFSC", "LocType", "PIF Number"
                dict["Grid"] = row.Cell(2).GetString().Trim();
                dict["State"] = row.Cell(3).GetString().Trim();
                dict["LocationName"] = row.Cell(4).GetString().Trim();
                dict["LocationCode"] = row.Cell(5).GetString().Trim();
                dict["ClusterCode"] = row.Cell(6).GetString().Trim();
                dict["Zone"] = row.Cell(7).GetString().Trim();
                dict["ScannerID"] = row.Cell(8).GetString().Trim();
                dict["BOFD"] = row.Cell(9).GetString().Trim();
                dict["PreTrun"] = row.Cell(10).GetString().Trim();
                dict["DepositAccount"] = row.Cell(11).GetString().Trim();
                dict["IFSC"] = row.Cell(12).GetString().Trim();
                dict["LocType"] = row.Cell(13).GetString().Trim();
                dict["PIFPrefix"] = row.Cell(14).GetString().Trim();
            }
            else if (type == "Client")
            {
                // Headers: "CITY_CODE", "NAME", "ADDRESS1", "ADDRESS2", "ADDRESS3", "ADDRESS4", "ADDRESS5", "PICKUP_POINT_CODE", "PICKUPPOINT_DESCRIPTION", "RCMS_CODE", "STATUS", "STATUS_DATE"
                dict["CityCode"] = row.Cell(1).GetString().Trim();
                dict["ClientName"] = row.Cell(2).GetString().Trim();
                dict["Address1"] = row.Cell(3).GetString().Trim();
                dict["Address2"] = row.Cell(4).GetString().Trim();
                dict["Address3"] = row.Cell(5).GetString().Trim();
                dict["Address4"] = row.Cell(6).GetString().Trim();
                dict["Address5"] = row.Cell(7).GetString().Trim();
                dict["PickupPointCode"] = row.Cell(8).GetString().Trim();
                dict["PickupPointDesc"] = row.Cell(9).GetString().Trim();
                dict["RCMSCode"] = row.Cell(10).GetString().Trim();
                dict["Status"] = row.Cell(11).GetString().Trim();
                dict["StatusDate"] = row.Cell(12).GetString().Trim();
            }
            return dict;
        }

        private async Task UpsertLocationAsync(CpsDbContext db, Dictionary<string, string> values, int userId)
        {
            var code = values["LocationCode"];
            if (string.IsNullOrWhiteSpace(code)) throw new Exception("LocationCode is required");

            var location = await db.Locations.FirstOrDefaultAsync(l => l.LocationCode == code && !l.IsDeleted);
            if (location == null)
            {
                location = new Location { LocationCode = code, CreatedBy = userId, CreatedAt = DateTime.UtcNow };
                db.Locations.Add(location);
            }
            location.LocationName = values["LocationName"];
            location.State = values["State"];
            location.Grid = values["Grid"];
            location.ClusterCode = values["ClusterCode"];
            location.Zone = values["Zone"];
            location.LocType = values["LocType"];
            location.PIFPrefix = values["PIFPrefix"];
            location.UpdatedBy = userId;
            location.UpdatedAt = DateTime.UtcNow;

            // Finance
            var finance = await db.LocationFinances.FirstOrDefaultAsync(f => f.LocationID == location.LocationID);
            if (finance == null)
            {
                finance = new LocationFinance { LocationID = location.LocationID, CreatedBy = userId, CreatedAt = DateTime.UtcNow };
                db.LocationFinances.Add(finance);
            }
            finance.BOFD = values["BOFD"];
            finance.PreTrun = values["PreTrun"];
            finance.DepositAccount = values["DepositAccount"];
            finance.IFSC = values["IFSC"];
            finance.UpdatedBy = userId;
            finance.UpdatedAt = DateTime.UtcNow;

            // Scanners
            var scannerId = values["ScannerID"];
            if (!string.IsNullOrWhiteSpace(scannerId))
            {
                var scanner = await db.LocationScanners.FirstOrDefaultAsync(s => s.LocationID == location.LocationID && s.ScannerID == scannerId);
                if (scanner == null)
                {
                    db.LocationScanners.Add(new LocationScanner 
                    { 
                        LocationID = location.LocationID, 
                        ScannerID = scannerId, 
                        CreatedBy = userId, 
                        CreatedAt = DateTime.UtcNow 
                    });
                }
            }
        }

        private async Task UpsertClientAsync(CpsDbContext db, Dictionary<string, string> values, int userId)
        {
            var city = values["CityCode"];
            var rcms = values["RCMSCode"];
            var pp = values["PickupPointCode"];
            
            if (string.IsNullOrWhiteSpace(city)) throw new Exception("CityCode is required");

            var client = await db.Clients.FirstOrDefaultAsync(c => 
                c.CityCode == city && c.RCMSCode == rcms && c.PickupPointCode == pp && !c.IsDeleted);
            
            if (client == null)
            {
                client = new ClientMaster 
                { 
                    CityCode = city, RCMSCode = rcms, PickupPointCode = pp, 
                    CreatedBy = userId, CreatedAt = DateTime.UtcNow 
                };
                db.Clients.Add(client);
            }
            client.ClientName = values["ClientName"];
            client.Address1 = values["Address1"];
            client.Address2 = values["Address2"];
            client.Address3 = values["Address3"];
            client.Address4 = values["Address4"];
            client.Address5 = values["Address5"];
            client.PickupPointDesc = values["PickupPointDesc"];
            client.Status = values["Status"];

            if (!string.IsNullOrWhiteSpace(values["StatusDate"]))
            {
                if (DateTime.TryParse(values["StatusDate"], out var dt))
                    client.StatusDate = DateOnly.FromDateTime(dt);
            }

            client.UpdatedBy = userId;
            client.UpdatedAt = DateTime.UtcNow;
        }
        private async Task ProcessScbMasterImportAsync(BackgroundJob job, string filePath, IServiceProvider sp, CancellationToken ct)
        {
            var scbService = sp.GetRequiredService<IScbMasterService>();
            using var stream = File.OpenRead(filePath);
            
            // For XML, we don't have easy row count without parsing twice, 
            // but we can set it to a dummy or update it after parsing.
            job.TotalRows = 100; // Placeholder
            job.Status = JobStatus.Processing;
            job.ProgressPercent = 10;
            
            var result = await scbService.UploadXmlAsync(stream, job.CreatedBy);
            
            if (!result.Success)
            {
                throw new Exception(result.Message);
            }

            job.ProgressPercent = 100;
            job.InsertedCount = 1; // Mark as done
        }
    }
}
