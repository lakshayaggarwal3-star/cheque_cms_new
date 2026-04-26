// =============================================================================
// File        : ScbMasterService.cs
// Project     : CPS — Cheque Processing System
// Module      : SCB Master
// Description : High-performance XML parsing and bulk loading for CHM data.
// Created     : 2026-04-25
// =============================================================================

using System.Data;
using System.Xml;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using ClosedXML.Excel;
using CPS.API.Models;
using CPS.API.DTOs;

namespace CPS.API.Services;

public interface IScbMasterService
{
    Task<List<ScbMasterStatusDto>> GetStatusAsync();
    Task<ScbUploadResultDto> UploadXmlAsync(Stream xmlStream, int userId);
    Task<PagedResult<object>> GetSectionDataAsync(string section, string? q, int page, int pageSize);
    Task ClearDataAsync();
    Task ClearSectionAsync(string section);
    Task<byte[]> ExportToExcelAsync(string section);
}

public class ScbMasterService : IScbMasterService
{
    private readonly CpsDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<ScbMasterService> _logger;

    public ScbMasterService(CpsDbContext db, IConfiguration config, ILogger<ScbMasterService> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    public async Task<List<ScbMasterStatusDto>> GetStatusAsync()
    {
        var statuses = await _db.ScbMasterStatuses.ToListAsync();
        var users = await _db.Users.ToDictionaryAsync(u => u.UserID, u => u.Username);

        return statuses.Select(s => new ScbMasterStatusDto
        {
            SectionName = s.SectionName,
            LastUpdatedAt = s.LastUpdatedAt,
            RecordCount = s.RecordCount,
            Version = s.Version,
            UpdatedByUserName = users.TryGetValue(s.UpdatedBy, out var name) ? name : "Unknown"
        }).ToList();
    }

    public async Task<ScbUploadResultDto> UploadXmlAsync(Stream xmlStream, int userId)
    {
        var result = new ScbUploadResultDto { Success = true };
        var version = string.Empty;

        // Use DataTables for bulk copy
        var branchTable = CreateBranchDataTable();
        var transRuleTable = CreateTranslationRuleDataTable();

        // Standard lists for smaller tables
        var banks = new List<ScbBank>();
        var reasons = new List<ScbReturnReason>();
        var sessions = new List<ScbSessionDefinition>();
        var cities = new List<ScbCityMaster>();

        using var reader = XmlReader.Create(xmlStream, new XmlReaderSettings { Async = true });
        _logger.LogInformation("Starting CHM XML Parse. File stream opened.");

        int totalParsed = 0;
        while (await reader.ReadAsync())
        {
            if (reader.NodeType != XmlNodeType.Element) continue;

            string tag = reader.LocalName;
            totalParsed++;
            if (totalParsed % 10000 == 0) _logger.LogInformation("Parsing progress: {Total} nodes processed...", totalParsed);


            switch (tag)
            {
                case "CHMaster":
                    version = reader.GetAttribute("Version");
                    break;

                case "Bank":
                    banks.Add(new ScbBank
                    {
                        BankRoutingNo = reader.GetAttribute("BANK_ROUTING_NBR") ?? "",
                        Name = reader.GetAttribute("NAME"),
                        StreetAddress = reader.GetAttribute("STREET_ADDRESS"),
                        City = reader.GetAttribute("CITY"),
                        StateProvince = reader.GetAttribute("STATE_PROVINCE"),
                        PostalZipCode = reader.GetAttribute("POSTAL_ZIP_CODE"),
                        Country = reader.GetAttribute("COUNTRY"),
                        ClearingStatusCode = reader.GetAttribute("CLEARING_STATUS_CODE"),
                        Note = reader.GetAttribute("NOTE"),
                        ServiceBranchRoutingNo = reader.GetAttribute("SERVICE_BRANCH_ROUTING_NBR"),
                        DesignatedBranchRoutingNo = reader.GetAttribute("DESIGNATED_BRANCH_ROUTING_NBR"),
                        CbsEnabled = reader.GetAttribute("CBS_ENABLED") == "1"
                    });
                    break;

                case "Branch":
                    branchTable.Rows.Add(
                        reader.GetAttribute("BRANCH_ROUTING_NBR") ?? "",
                        reader.GetAttribute("BANK_ROUTING_NBR") ?? "",
                        reader.GetAttribute("NAME"),
                        reader.GetAttribute("STREET_ADDRESS"),
                        reader.GetAttribute("CITY"),
                        reader.GetAttribute("STATE_PROVINCE"),
                        reader.GetAttribute("POSTAL_ZIP_CODE"),
                        reader.GetAttribute("COUNTRY"),
                        reader.GetAttribute("BRANCH_NUMBER"),
                        reader.GetAttribute("NOTE"),
                        DateTime.UtcNow
                    );
                    break;

                case "ItemReturnReason":
                    reasons.Add(new ScbReturnReason
                    {
                        ReturnReasonCode = reader.GetAttribute("RETURN_REASON_CODE") ?? "",
                        Description = reader.GetAttribute("DESCRIPTION") ?? ""
                    });
                    break;

                case "SessionDefinition":
                    sessions.Add(new ScbSessionDefinition
                    {
                        SessionNbr = reader.GetAttribute("SESSION_NBR") ?? "",
                        Description = reader.GetAttribute("DESCRIPTION"),
                        OpenReceivingTime = reader.GetAttribute("OPEN_RECEIVING_TIME"),
                        CloseReceivingTime = reader.GetAttribute("CLOSE_RECEIVING_TIME"),
                        CalendarCode = reader.GetAttribute("CALENDAR_CODE"),
                        CurrencyCode = reader.GetAttribute("CURRENCY_CODE")
                    });
                    break;

                case "CityMaster":
                    cities.Add(new ScbCityMaster
                    {
                        CityCode = reader.GetAttribute("CITY_CODE") ?? "",
                        CityName = reader.GetAttribute("CITY_NAME") ?? "",
                        ClearingType = reader.GetAttribute("CLEARING_TYPE")
                    });
                    break;

                case "TranslationRule":
                    transRuleTable.Rows.Add(
                        0, // Identity PK
                        reader.GetAttribute("PAYOR_BANK_ROUTING_NBR") ?? "",
                        reader.GetAttribute("LOGICAL_ROUTING_NBR") ?? "",
                        reader.GetAttribute("DESCRIPTION"),
                        reader.GetAttribute("FROM_DATE"),
                        reader.GetAttribute("TO_DATE")
                    );
                    break;
            }
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            _logger.LogInformation("XML Parsing complete ({Total} nodes). Committing to database inside transaction...", totalParsed);
            string finalVersion = version ?? "1.0.0";
            if (banks.Any()) {
                _logger.LogInformation("Reloading {Count} Banks...", banks.Count);
                await ReloadSectionAsync("Bank", banks, userId, finalVersion);
            }
            if (reasons.Any()) {
                await ReloadSectionAsync("ReturnReason", reasons, userId, finalVersion);
            }
            if (sessions.Any()) {
                await ReloadSectionAsync("Session", sessions, userId, finalVersion);
            }
            if (cities.Any()) {
                await ReloadSectionAsync("City", cities, userId, finalVersion);
            }

            if (branchTable.Rows.Count > 0) {
                _logger.LogInformation("Bulk loading {Count} Branches...", branchTable.Rows.Count);
                await BulkReloadAsync("ScbBranches", branchTable, "Branch", userId, finalVersion);
            }

            if (transRuleTable.Rows.Count > 0) {
                _logger.LogInformation("Bulk loading {Count} Translation Rules...", transRuleTable.Rows.Count);
                await BulkReloadAsync("ScbTranslationRules", transRuleTable, "TranslationRule", userId, finalVersion);
            }

            await transaction.CommitAsync();
            _logger.LogInformation("CHM Master Upload Transaction COMMITTED successfully.");
            result.Message = "Master data uploaded successfully.";
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "SCB Master Upload Failed");
            result.Success = false;
            result.Message = $"Upload failed: {ex.Message}";
        }

        return result;
    }

    public async Task<PagedResult<object>> GetSectionDataAsync(string section, string? q, int page, int pageSize)
    {
        IQueryable<object> query;
        int total;

        switch (section.ToLower())
        {
            case "bank":
                var bQ = _db.ScbBanks.AsQueryable();
                if (!string.IsNullOrEmpty(q)) bQ = bQ.Where(x => x.Name!.Contains(q) || x.BankRoutingNo.Contains(q));
                total = await bQ.CountAsync();
                query = bQ.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize);
                break;

            case "branch":
                var brQ = _db.ScbBranches.AsQueryable();
                if (!string.IsNullOrEmpty(q)) brQ = brQ.Where(x => x.Name!.Contains(q) || x.BranchRoutingNo.Contains(q) || x.BankRoutingNo.Contains(q));
                total = await brQ.CountAsync();
                query = brQ.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize);
                break;

            case "returnreason":
                var rQ = _db.ScbReturnReasons.AsQueryable();
                if (!string.IsNullOrEmpty(q)) rQ = rQ.Where(x => x.Description.Contains(q) || x.ReturnReasonCode.Contains(q));
                total = await rQ.CountAsync();
                query = rQ.OrderBy(x => x.ReturnReasonCode).Skip((page - 1) * pageSize).Take(pageSize);
                break;

            case "session":
                var sQ = _db.ScbSessionDefinitions.AsQueryable();
                if (!string.IsNullOrEmpty(q)) sQ = sQ.Where(x => x.Description!.Contains(q) || x.SessionNbr.Contains(q));
                total = await sQ.CountAsync();
                query = sQ.OrderBy(x => x.SessionNbr).Skip((page - 1) * pageSize).Take(pageSize);
                break;

            case "city":
                var cQ = _db.ScbCities.AsQueryable();
                if (!string.IsNullOrEmpty(q)) cQ = cQ.Where(x => x.CityName.Contains(q) || x.CityCode.Contains(q));
                total = await cQ.CountAsync();
                query = cQ.OrderBy(x => x.CityName).Skip((page - 1) * pageSize).Take(pageSize);
                break;

            case "translationrule":
                var tQ = _db.ScbTranslationRules.AsQueryable();
                if (!string.IsNullOrEmpty(q)) tQ = tQ.Where(x => x.PayorBankRoutingNo.Contains(q) || x.LogicalRoutingNo.Contains(q) || x.Description!.Contains(q));
                total = await tQ.CountAsync();
                query = tQ.OrderBy(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize);
                break;

            default:
                throw new ArgumentException("Invalid section");
        }

        return new PagedResult<object>
        {
            Items = await query.ToListAsync(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }

    private async Task ReloadSectionAsync<T>(string sectionName, List<T> data, int userId, string version) where T : class
    {
        // Truncate existing
        var table = _db.Set<T>();
        await _db.Database.ExecuteSqlRawAsync($"TRUNCATE TABLE {_db.Model.FindEntityType(typeof(T))?.GetTableName()}");
        
        // Insert new
        await table.AddRangeAsync(data);
        await _db.SaveChangesAsync();

        // Update status
        await UpdateStatusAsync(sectionName, data.Count, userId, version);
    }

    private async Task BulkReloadAsync(string tableName, DataTable data, string sectionName, int userId, string version)
    {
        var sqlConn = (SqlConnection)_db.Database.GetDbConnection();
        var sqlTrans = (SqlTransaction?)_db.Database.CurrentTransaction?.GetDbTransaction();

        if (sqlConn.State != ConnectionState.Open) await sqlConn.OpenAsync();

        // Truncate before bulk load (inside the same transaction)
        await _db.Database.ExecuteSqlRawAsync($"TRUNCATE TABLE {tableName}");

        using var bulkCopy = new SqlBulkCopy(sqlConn, SqlBulkCopyOptions.Default, sqlTrans);
        bulkCopy.DestinationTableName = tableName;
        bulkCopy.BatchSize = 10000;
        bulkCopy.BulkCopyTimeout = 600;

        foreach (DataColumn column in data.Columns)
            bulkCopy.ColumnMappings.Add(column.ColumnName, column.ColumnName);

        await bulkCopy.WriteToServerAsync(data);

        // Update status
        await UpdateStatusAsync(sectionName, data.Rows.Count, userId, version);
    }

    private async Task UpdateStatusAsync(string sectionName, int count, int userId, string version)
    {
        var status = await _db.ScbMasterStatuses.FindAsync(sectionName);
        if (status == null)
        {
            status = new ScbMasterStatus { SectionName = sectionName };
            _db.ScbMasterStatuses.Add(status);
        }

        status.LastUpdatedAt = DateTime.UtcNow;
        status.RecordCount = count;
        status.Version = version;
        status.UpdatedBy = userId;

        await _db.SaveChangesAsync();
    }

    private DataTable CreateBranchDataTable()
    {
        var dt = new DataTable();
        dt.Columns.Add("BranchRoutingNo", typeof(string));
        dt.Columns.Add("BankRoutingNo", typeof(string));
        dt.Columns.Add("Name", typeof(string));
        dt.Columns.Add("StreetAddress", typeof(string));
        dt.Columns.Add("City", typeof(string));
        dt.Columns.Add("StateProvince", typeof(string));
        dt.Columns.Add("PostalZipCode", typeof(string));
        dt.Columns.Add("Country", typeof(string));
        dt.Columns.Add("BranchNumber", typeof(string));
        dt.Columns.Add("Note", typeof(string));
        dt.Columns.Add("CreatedAt", typeof(DateTime));
        return dt;
    }

    private DataTable CreateTranslationRuleDataTable()
    {
        var dt = new DataTable();
        dt.Columns.Add("Id", typeof(int));
        dt.Columns.Add("PayorBankRoutingNo", typeof(string));
        dt.Columns.Add("LogicalRoutingNo", typeof(string));
        dt.Columns.Add("Description", typeof(string));
        dt.Columns.Add("FromDate", typeof(string));
        dt.Columns.Add("ToDate", typeof(string));
        return dt;
    }

    public async Task ClearDataAsync()
    {
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE ScbBanks");
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE ScbBranches");
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE ScbReturnReasons");
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE ScbSessionDefinitions");
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE ScbCityMasters");
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE ScbTranslationRules");
        await _db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE ScbMasterStatuses");
    }

    public async Task ClearSectionAsync(string section)
    {
        string table = section.ToLower() switch
        {
            "bank" => "ScbBanks",
            "branch" => "ScbBranches",
            "returnreason" => "ScbReturnReasons",
            "session" => "ScbSessionDefinitions",
            "city" => "ScbCityMasters",
            "translationrule" => "ScbTranslationRules",
            _ => throw new Exception("Invalid section")
        };
        await _db.Database.ExecuteSqlRawAsync($"TRUNCATE TABLE {table}");
        
        var status = await _db.ScbMasterStatuses.FindAsync(section);
        if (status != null)
        {
            status.RecordCount = 0;
            status.LastUpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    public async Task<byte[]> ExportToExcelAsync(string section)
    {
        var dataResult = await GetSectionDataAsync(section, null, 1, 100000);
        var items = dataResult.Items;

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(section);

        if (items.Any())
        {
            var first = items.First();
            var props = first.GetType().GetProperties();
            
            // Headers
            for (int i = 0; i < props.Length; i++)
            {
                ws.Cell(1, i + 1).Value = props[i].Name;
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }

            // Data
            for (int r = 0; r < items.Count; r++)
            {
                var item = items[r];
                for (int c = 0; c < props.Length; c++)
                {
                    ws.Cell(r + 2, c + 1).Value = props[c].GetValue(item)?.ToString();
                }
            }
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }
}
