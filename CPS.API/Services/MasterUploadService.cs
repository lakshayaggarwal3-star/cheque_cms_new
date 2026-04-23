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

namespace CPS.API.Services;

public class MasterUploadService
{
    private readonly ILocationRepository _locationRepo;
    private readonly IClientRepository _clientRepo;
    private readonly CpsDbContext _db;

    public MasterUploadService(ILocationRepository locationRepo, IClientRepository clientRepo, CpsDbContext db)
    {
        _locationRepo = locationRepo;
        _clientRepo = clientRepo;
        _db = db;
    }

    public async Task<UploadResultDto> UploadLocationAsync(IFormFile file, int userId)
    {
        ValidateFile(file);

        var result = new UploadResultDto();
        var errors = new List<UploadErrorDto>();

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);
        var rows = ws.RangeUsed()?.RowsUsed().Skip(1).ToList() ?? new();
        result.TotalRows = rows.Count;

        foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
        {
            try
            {
                var locationCode = row.Cell(5).GetString().Trim();
                var locationName = row.Cell(4).GetString().Trim();

                if (string.IsNullOrEmpty(locationCode) || string.IsNullOrEmpty(locationName))
                {
                    errors.Add(new() { RowNumber = idx, Field = "LocationCode/Name", Message = "Location code and name are required." });
                    result.ErrorRows++;
                    continue;
                }

                var existing = await _locationRepo.GetByCodeAsync(locationCode);
                var location = existing ?? new Location();

                location.LocationName = locationName;
                location.LocationCode = locationCode;
                location.Grid = row.Cell(1).GetString().Trim();
                location.State = row.Cell(2).GetString().Trim();
                location.ClusterCode = row.Cell(6).GetString().Trim();
                location.Zone = row.Cell(7).GetString().Trim();
                location.LocType = row.Cell(13).GetString().Trim();
                location.PIFPrefix = row.Cell(14).GetString().Trim();
                location.IsActive = true;
                location.UpdatedBy = userId;
                location.UpdatedAt = DateTime.UtcNow;

                if (existing == null)
                {
                    location.CreatedBy = userId;
                    location.CreatedAt = DateTime.UtcNow;
                    await _locationRepo.CreateAsync(location);
                }
                else
                    await _locationRepo.UpdateAsync(location);

                // Scanner
                var scannerId = row.Cell(8).GetString().Trim();
                if (!string.IsNullOrEmpty(scannerId) && scannerId != "000")
                {
                    await _locationRepo.UpsertScannerAsync(new LocationScanner
                    {
                        LocationID = location.LocationID,
                        ScannerID = scannerId,
                        ScannerModel = "Ranger",
                        ScannerType = "Cheque",
                        IsActive = true,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = userId,
                        UpdatedAt = DateTime.UtcNow
                    });
                }

                // Finance
                await _locationRepo.UpsertFinanceAsync(new LocationFinance
                {
                    LocationID = location.LocationID,
                    BOFD = row.Cell(9).GetString().Trim(),
                    PreTrun = row.Cell(10).GetString().Trim(),
                    DepositAccount = row.Cell(11).GetString().Trim(),
                    IFSC = row.Cell(12).GetString().Trim(),
                    UpdatedBy = userId,
                    UpdatedAt = DateTime.UtcNow
                });

                result.SuccessRows++;
            }
            catch (Exception ex)
            {
                errors.Add(new() { RowNumber = idx, Field = "Row", Message = ex.Message });
                result.ErrorRows++;
            }
        }

        result.Status = result.ErrorRows == 0 ? "Success"
            : result.SuccessRows == 0 ? "Failed" : "PartialSuccess";
        result.Errors = errors;

        await LogUploadAsync("Location", file.FileName, userId, result);
        return result;
    }

    public async Task<UploadResultDto> UploadClientAsync(IFormFile file, int userId)
    {
        ValidateFile(file);

        var result = new UploadResultDto();
        var errors = new List<UploadErrorDto>();

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);
        var rows = ws.RangeUsed()?.RowsUsed().Skip(1).ToList() ?? new();
        result.TotalRows = rows.Count;

        foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
        {
            try
            {
                var cityCode = row.Cell(1).GetString().Trim();
                var name = row.Cell(2).GetString().Trim();
                var status = row.Cell(11).GetString().Trim().ToUpperInvariant();

                if (string.IsNullOrEmpty(cityCode) || string.IsNullOrEmpty(name))
                {
                    errors.Add(new() { RowNumber = idx, Field = "CITY_CODE/NAME", Message = "City code and name are required." });
                    result.ErrorRows++;
                    continue;
                }

                if (status != "A" && status != "X")
                {
                    errors.Add(new() { RowNumber = idx, Field = "STATUS", Message = "Status must be A or X." });
                    result.ErrorRows++;
                    continue;
                }

                var statusDateStr = row.Cell(12).GetString().Trim();
                DateOnly? statusDate = null;
                if (!string.IsNullOrEmpty(statusDateStr) &&
                    DateOnly.TryParse(statusDateStr, out var sd))
                    statusDate = sd;

                await _clientRepo.UpsertAsync(new ClientMaster
                {
                    CityCode = cityCode,
                    ClientName = name,
                    Address1 = row.Cell(3).GetString().Trim(),
                    Address2 = row.Cell(4).GetString().Trim(),
                    Address3 = row.Cell(5).GetString().Trim(),
                    Address4 = row.Cell(6).GetString().Trim(),
                    Address5 = row.Cell(7).GetString().Trim(),
                    PickupPointCode = row.Cell(8).GetString().Trim(),
                    PickupPointDesc = row.Cell(9).GetString().Trim(),
                    RCMSCode = row.Cell(10).GetString().Trim(),
                    Status = status,
                    StatusDate = statusDate,
                    UpdatedBy = userId,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                });

                result.SuccessRows++;
            }
            catch (Exception ex)
            {
                errors.Add(new() { RowNumber = idx, Field = "Row", Message = ex.Message });
                result.ErrorRows++;
            }
        }

        result.Status = result.ErrorRows == 0 ? "Success"
            : result.SuccessRows == 0 ? "Failed" : "PartialSuccess";
        result.Errors = errors;

        await LogUploadAsync("Client", file.FileName, userId, result);
        return result;
    }

    public async Task<MasterPreviewDto> PreviewLocationAsync(IFormFile file)
    {
        ValidateFile(file);
        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);
        var rows = ws.RangeUsed()?.RowsUsed().Skip(1).ToList() ?? new();

        var result = new MasterPreviewDto { MasterType = "location", TotalRows = rows.Count };
        foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
        {
            var locationCode = row.Cell(5).GetString().Trim();
            var locationName = row.Cell(4).GetString().Trim();

            // Skip completely empty rows
            if (string.IsNullOrWhiteSpace(locationCode) && string.IsNullOrWhiteSpace(locationName))
            {
                result.TotalRows--; // Don't count empty rows
                continue;
            }

            var item = new MasterDataRowDto
            {
                Values = new Dictionary<string, string?>
                {
                    ["Grid"] = row.Cell(1).GetString().Trim(),
                    ["State"] = row.Cell(2).GetString().Trim(),
                    ["LocationName"] = locationName,
                    ["LocationCode"] = locationCode,
                    ["ClusterCode"] = row.Cell(6).GetString().Trim(),
                    ["Zone"] = row.Cell(7).GetString().Trim(),
                    ["ScannerID"] = row.Cell(8).GetString().Trim(),
                    ["BOFD"] = row.Cell(9).GetString().Trim(),
                    ["PreTrun"] = row.Cell(10).GetString().Trim(),
                    ["DepositAccount"] = row.Cell(11).GetString().Trim(),
                    ["IFSC"] = row.Cell(12).GetString().Trim(),
                    ["LocType"] = row.Cell(13).GetString().Trim(),
                    ["PIFPrefix"] = row.Cell(14).GetString().Trim()
                }
            };
            result.Rows.Add(item);

            // Only error if both are required but empty
            if (string.IsNullOrWhiteSpace(item.Values["LocationCode"]) || string.IsNullOrWhiteSpace(item.Values["LocationName"]))
                result.Errors.Add(new UploadErrorDto { RowNumber = idx, Field = "LocationCode/LocationName", Message = "Location code and name are required." });
        }

        result.ErrorRows = result.Errors.Count;
        result.ValidRows = Math.Max(0, result.Rows.Count - result.ErrorRows);
        return result;
    }

    public async Task<MasterPreviewDto> PreviewClientAsync(IFormFile file)
    {
        ValidateFile(file);
        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);
        var rows = ws.RangeUsed()?.RowsUsed().Skip(1).ToList() ?? new();

        var result = new MasterPreviewDto { MasterType = "client", TotalRows = rows.Count };
        foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
        {
            var cityCode = row.Cell(1).GetString().Trim();
            var clientName = row.Cell(2).GetString().Trim();

            // Skip completely empty rows
            if (string.IsNullOrWhiteSpace(cityCode) && string.IsNullOrWhiteSpace(clientName))
            {
                result.TotalRows--; // Don't count empty rows
                continue;
            }

            var item = new MasterDataRowDto
            {
                Values = new Dictionary<string, string?>
                {
                    ["CityCode"] = cityCode,
                    ["ClientName"] = clientName,
                    ["Address1"] = row.Cell(3).GetString().Trim(),
                    ["Address2"] = row.Cell(4).GetString().Trim(),
                    ["Address3"] = row.Cell(5).GetString().Trim(),
                    ["Address4"] = row.Cell(6).GetString().Trim(),
                    ["Address5"] = row.Cell(7).GetString().Trim(),
                    ["PickupPointCode"] = row.Cell(8).GetString().Trim(),
                    ["PickupPointDesc"] = row.Cell(9).GetString().Trim(),
                    ["RCMSCode"] = row.Cell(10).GetString().Trim(),
                    ["Status"] = row.Cell(11).GetString().Trim().ToUpperInvariant(),
                    ["StatusDate"] = row.Cell(12).GetString().Trim(),
                    ["GlobalCode"] = row.Cell(13).GetString().Trim(),
                    ["IsPriority"] = row.Cell(14).GetString().Trim()
                }
            };
            result.Rows.Add(item);

            // Only error on required fields
            if (string.IsNullOrWhiteSpace(item.Values["CityCode"]) || string.IsNullOrWhiteSpace(item.Values["ClientName"]))
                result.Errors.Add(new UploadErrorDto { RowNumber = idx, Field = "CityCode/ClientName", Message = "City code and client name are required." });
            if (!string.IsNullOrWhiteSpace(item.Values["Status"]) && item.Values["Status"] != "A" && item.Values["Status"] != "X")
                result.Errors.Add(new UploadErrorDto { RowNumber = idx, Field = "Status", Message = "Status must be A or X." });
        }

        result.ErrorRows = result.Errors.Count;
        result.ValidRows = Math.Max(0, result.Rows.Count - result.ErrorRows);
        return result;
    }


    public async Task<UploadResultDto> ApplyLocationRowsAsync(List<MasterDataRowDto> rows, int userId)
    {
        var result = new UploadResultDto { TotalRows = rows.Count };
        var errors = new List<UploadErrorDto>();
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            for (var i = 0; i < rows.Count; i++)
            {
                var rowNum = i + 1;
                var values = rows[i].Values;
                var code = Get(values, "LocationCode");
                var name = Get(values, "LocationName");
                if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
                {
                    errors.Add(new UploadErrorDto { RowNumber = rowNum, Field = "LocationCode/LocationName", Message = "Location code and name are required." });
                    result.ErrorRows++;
                    continue;
                }

                var location = await _db.Locations.FirstOrDefaultAsync(l => l.LocationCode == code && !l.IsDeleted);
                if (location == null)
                {
                    location = new Location
                    {
                        LocationCode = code,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.Locations.Add(location);
                }

                location.LocationName = name;
                location.Grid = Get(values, "Grid");
                location.State = Get(values, "State");
                location.ClusterCode = Get(values, "ClusterCode");
                location.Zone = Get(values, "Zone");
                location.LocType = Get(values, "LocType");
                location.PIFPrefix = Get(values, "PIFPrefix");
                location.IsActive = true;
                location.UpdatedBy = userId;
                location.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                var scannerId = Get(values, "ScannerID");
                if (!string.IsNullOrWhiteSpace(scannerId) && scannerId != "000")
                {
                    var scanner = await _db.LocationScanners.FirstOrDefaultAsync(s => s.LocationID == location.LocationID && s.ScannerID == scannerId);
                    if (scanner == null)
                    {
                        _db.LocationScanners.Add(new LocationScanner
                        {
                            LocationID = location.LocationID,
                            ScannerID = scannerId,
                            ScannerModel = "Ranger",
                            ScannerType = "Cheque",
                            IsActive = true,
                            CreatedBy = userId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedBy = userId,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                    else
                    {
                        scanner.IsActive = true;
                        scanner.UpdatedBy = userId;
                        scanner.UpdatedAt = DateTime.UtcNow;
                    }
                }

                var finance = await _db.LocationFinances.FirstOrDefaultAsync(f => f.LocationID == location.LocationID);
                if (finance == null)
                {
                    _db.LocationFinances.Add(new LocationFinance
                    {
                        LocationID = location.LocationID,
                        BOFD = Get(values, "BOFD"),
                        PreTrun = Get(values, "PreTrun"),
                        DepositAccount = Get(values, "DepositAccount"),
                        IFSC = Get(values, "IFSC"),
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedBy = userId,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    finance.BOFD = Get(values, "BOFD");
                    finance.PreTrun = Get(values, "PreTrun");
                    finance.DepositAccount = Get(values, "DepositAccount");
                    finance.IFSC = Get(values, "IFSC");
                    finance.UpdatedBy = userId;
                    finance.UpdatedAt = DateTime.UtcNow;
                }

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
        await LogUploadAsync("Location", "MasterSectionBulkApply", userId, result);
        return result;
    }

    public async Task<UploadResultDto> ApplyClientRowsAsync(List<MasterDataRowDto> rows, int userId)
    {
        var result = new UploadResultDto { TotalRows = rows.Count };
        var errors = new List<UploadErrorDto>();
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            for (var i = 0; i < rows.Count; i++)
            {
                var rowNum = i + 1;
                var values = rows[i].Values;
                var cityCode = Get(values, "CityCode");
                var clientName = Get(values, "ClientName");
                var rcmsCode = Get(values, "RCMSCode");
                var globalCode = Get(values, "GlobalCode");
                var isPriorityStr = Get(values, "IsPriority");
                var status = Get(values, "Status").ToUpperInvariant();

                if (string.IsNullOrWhiteSpace(cityCode) || string.IsNullOrWhiteSpace(clientName))
                {
                    errors.Add(new UploadErrorDto { RowNumber = rowNum, Field = "CityCode/ClientName", Message = "City code and client name are required." });
                    result.ErrorRows++;
                    continue;
                }

                int? globalId = null;
                bool isPriority = isPriorityStr.Equals("true", StringComparison.OrdinalIgnoreCase) || isPriorityStr.Equals("1");

                if (!string.IsNullOrWhiteSpace(globalCode))
                {
                    var global = await _db.GlobalClients.FirstOrDefaultAsync(g => g.GlobalCode.ToUpper() == globalCode.ToUpper());
                    if (global == null)
                    {
                        global = new GlobalClient
                        {
                            GlobalCode = globalCode.ToUpper(),
                            GlobalName = clientName,
                            IsPriority = isPriority,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _db.GlobalClients.Add(global);
                        await _db.SaveChangesAsync();
                    }
                    else if (isPriority != global.IsPriority)
                    {
                        global.IsPriority = isPriority;
                        global.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();

                        // Sync existing clients in this group
                        var groupClients = await _db.Clients.Where(c => c.GlobalClientID == global.GlobalClientID && !c.IsDeleted).ToListAsync();
                        foreach (var gc in groupClients)
                        {
                            gc.IsPriority = isPriority;
                        }
                    }
                    globalId = global.GlobalClientID;

                }

                DateOnly? statusDate = null;
                if (DateOnly.TryParse(Get(values, "StatusDate"), out var sd))
                    statusDate = sd;

                _db.Clients.Add(new ClientMaster
                {
                    CityCode = cityCode,
                    ClientName = clientName,
                    Address1 = Get(values, "Address1"),
                    Address2 = Get(values, "Address2"),
                    Address3 = Get(values, "Address3"),
                    Address4 = Get(values, "Address4"),
                    Address5 = Get(values, "Address5"),
                    PickupPointCode = Get(values, "PickupPointCode"),
                    PickupPointDesc = Get(values, "PickupPointDesc"),
                    RCMSCode = rcmsCode,
                    Status = !string.IsNullOrWhiteSpace(status) ? status : "A",
                    StatusDate = statusDate,
                    GlobalClientID = globalId,
                    IsPriority = isPriority,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedBy = userId,
                    UpdatedAt = DateTime.UtcNow
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
        await LogUploadAsync("Client", "MasterSectionBulkApply", userId, result);
        return result;
    }


    private static void ValidateFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            throw new ValidationException("No file provided.");

        if (file.Length > 10 * 1024 * 1024)
            throw new ValidationException("File size exceeds 10MB limit.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx")
            throw new ValidationException("Only .xlsx files are accepted.");
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
