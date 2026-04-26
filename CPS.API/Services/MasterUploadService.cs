// =============================================================================
// File        : MasterUploadService.cs
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : Parses, verifies, and bulk-applies Location and Client master data.
// Created     : 2026-04-14
// =============================================================================

using ClosedXML.Excel;
using CPS.API.DTOs;
using CPS.API.Models;
using CPS.API.Repositories;
using CPS.API.Exceptions;
using Microsoft.EntityFrameworkCore;
using System.IO;

namespace CPS.API.Services;

public class MasterUploadService
{
    private readonly ILocationRepository _locationRepo;
    private readonly IClientRepository _clientRepo;
    private readonly CpsDbContext _db;
    private readonly IServiceProvider _serviceProvider;
    private readonly IJobSignalService _jobSignal;

    public MasterUploadService(ILocationRepository locationRepo, IClientRepository clientRepo, CpsDbContext db, IServiceProvider serviceProvider, IJobSignalService jobSignal)
    {
        _locationRepo = locationRepo;
        _clientRepo = clientRepo;
        _db = db;
        _serviceProvider = serviceProvider;
        _jobSignal = jobSignal;
    }


    public async Task<MasterPreviewDto> PreviewInternalBankAsync(IFormFile file)
    {
        await Task.Yield();
        ValidateFile(file);
        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);
        var rows = ws.RangeUsed()?.RowsUsed().Skip(1).ToList() ?? new();

        var result = new MasterPreviewDto { MasterType = "internal-bank", TotalRows = rows.Count };
        result.ParsingLogs.Add($"Opening workbook... found '{ws.Name}' worksheet.");
        result.ParsingLogs.Add($"Detected {rows.Count} data rows. Starting syntax validation...");

        foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
        {
            var ebank = row.Cell(1).GetString().Trim();
            var sortcode = row.Cell(2).GetString().Trim();

            if (string.IsNullOrWhiteSpace(ebank) && string.IsNullOrWhiteSpace(sortcode))
            {
                result.TotalRows--;
                continue;
            }

            var item = new MasterDataRowDto
            {
                Values = new Dictionary<string, string?>
                {
                    ["EBANK"] = ebank,
                    ["SORTCODE"] = sortcode,
                    ["NAME"] = row.Cell(3).GetString().Trim(),
                    ["FULLNAME"] = row.Cell(4).GetString().Trim(),
                    ["BRANCH"] = row.Cell(5).GetString().Trim()
                }
            };
            result.Rows.Add(item);

            if (string.IsNullOrWhiteSpace(ebank) || string.IsNullOrWhiteSpace(sortcode))
                result.Errors.Add(new UploadErrorDto { RowNumber = idx, Field = "EBANK/SORTCODE", Message = "EBANK and SORTCODE are required." });
        }

        result.ErrorRows = result.Errors.Count;
        result.ValidRows = Math.Max(0, result.Rows.Count - result.ErrorRows);
        result.ParsingLogs.Add($"Validation complete. Found {result.ValidRows} valid and {result.ErrorRows} invalid rows.");
        return result;
    }

    public async Task<MasterPreviewDto> PreviewCaptureRuleAsync(IFormFile file)
    {
        await Task.Yield();
        ValidateFile(file);
        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);
        var rows = ws.RangeUsed()?.RowsUsed().Skip(1).ToList() ?? new();

        var result = new MasterPreviewDto { MasterType = "capture-rule", TotalRows = rows.Count };
        result.ParsingLogs.Add($"Accessing Excel stream... parsing '{ws.Name}'.");
        result.ParsingLogs.Add($"Found {rows.Count} rows in Client Capture Rules table. Verifying schema...");

        foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
        {
            var ceid = row.Cell(1).GetString().Trim();
            var clientCode = row.Cell(2).GetString().Trim();

            if (string.IsNullOrWhiteSpace(ceid) && string.IsNullOrWhiteSpace(clientCode))
            {
                result.TotalRows--;
                continue;
            }

            var item = new MasterDataRowDto
            {
                Values = new Dictionary<string, string?>
                {
                    ["CEID"] = ceid,
                    ["ClientCode"] = clientCode,
                    ["FieldName1"] = row.Cell(3).GetString().Trim(),
                    ["FieldName2"] = row.Cell(4).GetString().Trim(),
                    ["FieldName3"] = row.Cell(5).GetString().Trim(),
                    ["FieldName4"] = row.Cell(6).GetString().Trim(),
                    ["FieldName5"] = row.Cell(7).GetString().Trim()
                }
            };
            result.Rows.Add(item);

            if (string.IsNullOrWhiteSpace(ceid) || string.IsNullOrWhiteSpace(clientCode))
                result.Errors.Add(new UploadErrorDto { RowNumber = idx, Field = "CEID/ClientCode", Message = "CEID and ClientCode are required." });
        }

        result.ErrorRows = result.Errors.Count;
        result.ValidRows = Math.Max(0, result.Rows.Count - result.ErrorRows);
        result.ParsingLogs.Add($"Syntax check finished. {result.ValidRows} rows ready for import.");
        return result;
    }


    public async Task<UploadResultDto> ApplyInternalBankRowsAsync(List<MasterDataRowDto> rows, int userId)
    {
        var result = new UploadResultDto { TotalRows = rows.Count };
        var errors = new List<UploadErrorDto>();
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Truncate and replace pattern as per other masters or standard bulk behavior
            // For these masters, we might just want to clear and reload if it's a full master
            _db.InternalBankMasters.RemoveRange(_db.InternalBankMasters);
            await _db.SaveChangesAsync();

            for (var i = 0; i < rows.Count; i++)
            {
                var values = rows[i].Values;
                _db.InternalBankMasters.Add(new InternalBankMaster
                {
                    EBANK = Get(values, "EBANK"),
                    SORTCODE = Get(values, "SORTCODE"),
                    NAME = Get(values, "NAME"),
                    FULLNAME = Get(values, "FULLNAME"),
                    BRANCH = Get(values, "BRANCH"),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId
                });
                result.SuccessRows++;
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            errors.Add(new UploadErrorDto { RowNumber = 0, Field = "Bulk", Message = ex.Message });
            result.ErrorRows++;
        }

        result.Errors = errors;
        result.Status = result.ErrorRows == 0 ? "Success" : result.SuccessRows == 0 ? "Failed" : "PartialSuccess";
        await LogUploadAsync("InternalBank", "BulkApply", userId, result);
        return result;
    }

    public async Task<UploadResultDto> ApplyCaptureRuleRowsAsync(List<MasterDataRowDto> rows, int userId)
    {
        var result = new UploadResultDto { TotalRows = rows.Count };
        var errors = new List<UploadErrorDto>();
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            _db.ClientCaptureRules.RemoveRange(_db.ClientCaptureRules);
            await _db.SaveChangesAsync();

            for (var i = 0; i < rows.Count; i++)
            {
                var values = rows[i].Values;
                _db.ClientCaptureRules.Add(new ClientCaptureRule
                {
                    CEID = Get(values, "CEID"),
                    ClientCode = Get(values, "ClientCode"),
                    FieldName1 = Get(values, "FieldName1"),
                    FieldName2 = Get(values, "FieldName2"),
                    FieldName3 = Get(values, "FieldName3"),
                    FieldName4 = Get(values, "FieldName4"),
                    FieldName5 = Get(values, "FieldName5"),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId
                });
                result.SuccessRows++;
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            errors.Add(new UploadErrorDto { RowNumber = 0, Field = "Bulk", Message = ex.Message });
            result.ErrorRows++;
        }

        result.Errors = errors;
        result.Status = result.ErrorRows == 0 ? "Success" : result.SuccessRows == 0 ? "Failed" : "PartialSuccess";
        await LogUploadAsync("CaptureRule", "BulkApply", userId, result);
        return result;
    }

    public async Task<JobStartDto> CreateUploadJobAsync(IFormFile file, string type, int userId)
    {
        ValidateFile(file, type);
        
        string uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Masters");
        if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

        string uniqueFileName = $"{Guid.NewGuid()}_{file.FileName}";
        string filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var job = new BackgroundJob
        {
            JobType = type,
            FileName = uniqueFileName,
            Status = JobStatus.Pending,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Jobs.Add(job);
        await _db.SaveChangesAsync();

        _jobSignal.SignalNewJob();

        return new JobStartDto
        {
            JobId = job.Id,
            Status = "Pending",
            Message = "Job created and queued for processing."
        };
    }

    public async Task<byte[]> ExportMasterToExcelAsync(string type)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(type);
        
        if (type == "location")
        {
            var data = await _db.Locations.ToListAsync();
            var headers = new[] { "LocationCode", "LocationName", "State", "Zone", "PIFPrefix", "IsActive" };
            for (int i = 0; i < headers.Length; i++) { ws.Cell(1, i + 1).Value = headers[i]; ws.Cell(1, i + 1).Style.Font.Bold = true; }
            for (int i = 0; i < data.Count; i++)
            {
                ws.Cell(i + 2, 1).Value = data[i].LocationCode;
                ws.Cell(i + 2, 2).Value = data[i].LocationName;
                ws.Cell(i + 2, 3).Value = data[i].State;
                ws.Cell(i + 2, 4).Value = data[i].Zone;
                ws.Cell(i + 2, 5).Value = data[i].PIFPrefix;
                ws.Cell(i + 2, 6).Value = data[i].IsActive ? "Yes" : "No";
            }
        }
        else if (type == "client")
        {
            var data = await _db.Clients.ToListAsync();
            var headers = new[] { "CityCode", "ClientName", "PickupPointCode", "RCMSCode", "Status" };
            for (int i = 0; i < headers.Length; i++) { ws.Cell(1, i + 1).Value = headers[i]; ws.Cell(1, i + 1).Style.Font.Bold = true; }
            for (int i = 0; i < data.Count; i++)
            {
                ws.Cell(i + 2, 1).Value = data[i].CityCode;
                ws.Cell(i + 2, 2).Value = data[i].ClientName;
                ws.Cell(i + 2, 3).Value = data[i].PickupPointCode;
                ws.Cell(i + 2, 4).Value = data[i].RCMSCode;
                ws.Cell(i + 2, 5).Value = data[i].Status;
            }
        }
        else if (type == "internal-bank")
        {
            var data = await _db.InternalBankMasters.ToListAsync();
            var headers = new[] { "EBANK", "SORTCODE", "NAME", "FULLNAME", "BRANCH" };
            for (int i = 0; i < headers.Length; i++) { ws.Cell(1, i + 1).Value = headers[i]; ws.Cell(1, i + 1).Style.Font.Bold = true; }
            for (int i = 0; i < data.Count; i++)
            {
                ws.Cell(i + 2, 1).Value = data[i].EBANK;
                ws.Cell(i + 2, 2).Value = data[i].SORTCODE;
                ws.Cell(i + 2, 3).Value = data[i].NAME;
                ws.Cell(i + 2, 4).Value = data[i].FULLNAME;
                ws.Cell(i + 2, 5).Value = data[i].BRANCH;
            }
        }
        else if (type == "capture-rule")
        {
            var data = await _db.ClientCaptureRules.ToListAsync();
            var headers = new[] { "CEID", "ClientCode", "FieldName1", "FieldName2", "FieldName3", "FieldName4", "FieldName5" };
            for (int i = 0; i < headers.Length; i++) { ws.Cell(1, i + 1).Value = headers[i]; ws.Cell(1, i + 1).Style.Font.Bold = true; }
            for (int i = 0; i < data.Count; i++)
            {
                ws.Cell(i + 2, 1).Value = data[i].CEID;
                ws.Cell(i + 2, 2).Value = data[i].ClientCode;
                ws.Cell(i + 2, 3).Value = data[i].FieldName1;
                ws.Cell(i + 2, 4).Value = data[i].FieldName2;
                ws.Cell(i + 2, 5).Value = data[i].FieldName3;
                ws.Cell(i + 2, 6).Value = data[i].FieldName4;
                ws.Cell(i + 2, 7).Value = data[i].FieldName5;
            }
        }
        
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void ValidateFile(IFormFile file, string jobType = "")
    {
        if (file == null || file.Length == 0)
            throw new ValidationException("No file provided.");

        long maxBytes = jobType == "scb-master" ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
        if (file.Length > maxBytes)
            throw new ValidationException($"File size exceeds {(jobType == "scb-master" ? "200MB" : "20MB")} limit.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (jobType == "scb-master")
        {
            if (ext != ".xml") throw new ValidationException("CHM Master requires an .xml file.");
        }
        else
        {
            if (ext != ".xlsx") throw new ValidationException("Only .xlsx files are accepted.");
        }
    }

    private async Task LogUploadAsync(string type, string fileName, int userId, UploadResultDto result)
    {
        _db.MasterUploadLogs.Add(new MasterUploadLog
        {
            MasterType = type,
            FileName = fileName,
            UploadedBy = userId,
            UploadDate = DateTime.UtcNow,
            Status = result.Status,
            TotalRows = result.TotalRows,
            SuccessRows = result.SuccessRows,
            ErrorRows = result.ErrorRows,
            ErrorLog = result.Errors.Any()
                ? System.Text.Json.JsonSerializer.Serialize(result.Errors)
                : null,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }

    private static string Get(Dictionary<string, string?> values, string key) =>
        values.TryGetValue(key, out var value) ? (value ?? string.Empty).Trim() : string.Empty;
}
