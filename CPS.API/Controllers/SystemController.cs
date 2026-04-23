// =============================================================================
// File        : SystemController.cs
// Project     : CPS — Cheque Processing System
// Module      : System / Admin
// Description : Health check endpoint for disk space and scanner service status.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Services;
using CPS.API.Models;
using CPS.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/system")]
[Authorize]
public class SystemController : ControllerBase
{
    private readonly IImageStorageConfig _imageConfig;
    private readonly IConfiguration _config;
    private readonly CpsDbContext _db;
    private readonly ILogger<SystemController> _logger;

    public SystemController(IImageStorageConfig imageConfig, IConfiguration config, CpsDbContext db, ILogger<SystemController> logger)
    {
        _imageConfig = imageConfig;
        _config = config;
        _db = db;
        _logger = logger;
    }

    [HttpGet("health")]
    public async Task<IActionResult> Health()
    {
        // Disk space check
        long freeBytes = 0;
        string diskWarning = string.Empty;
        try
        {
            var basePath = _imageConfig.BasePath;
            var drive = Path.GetPathRoot(basePath);
            if (drive != null)
            {
                var info = new DriveInfo(drive);
                freeBytes = info.AvailableFreeSpace;
                if (freeBytes < 1L * 1024 * 1024 * 1024)
                {
                    diskWarning = "CRITICAL: Less than 1GB free on image storage drive!";
                    _logger.LogError("Disk space critical: {FreeMB}MB free on {Drive}", freeBytes / 1024 / 1024, drive);
                }
                else if (freeBytes < 5L * 1024 * 1024 * 1024)
                {
                    diskWarning = "WARNING: Less than 5GB free on image storage drive.";
                    _logger.LogWarning("Disk space warning: {FreeMB}MB free on {Drive}", freeBytes / 1024 / 1024, drive);
                }
            }
        }
        catch { }

        // Scanner service check
        bool scannerOnline = false;
        try
        {
            var scannerUrl = _config["ScannerService:BaseUrl"] ?? "http://localhost:7000";
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var resp = await http.GetAsync($"{scannerUrl}/scanner/status");
            scannerOnline = resp.IsSuccessStatusCode;
        }
        catch { }

        return Ok(new
        {
            success = true,
            data = new
            {
                diskSpaceFreeGB = Math.Round(freeBytes / (1024.0 * 1024 * 1024), 2),
                diskWarning,
                scannerServiceOnline = scannerOnline,
                timestamp = DateTime.UtcNow
            }
        });
    }

    [HttpGet("roles")]
    public IActionResult GetRoles()
    {
        var roles = new List<RoleCatalogDto>
        {
            new() { Key = "roleScanner", Name = "Scanner", Description = "Desktop scanner operator." },
            new() { Key = "roleMobileScanner", Name = "MobileScanner", Description = "Mobile scanner operator." },
            new() { Key = "roleMaker", Name = "Maker", Description = "Maker data entry role." },
            new() { Key = "roleChecker", Name = "Checker", Description = "Checker authorization role." },
            new() { Key = "roleAdmin", Name = "Admin", Description = "System administrator role." },
            new() { Key = "roleImageViewer", Name = "ImageViewer", Description = "Restricted role for viewing cheque images only." },
            new() { Key = "isDeveloper", Name = "Developer", Description = "Developer tools and bypass capabilities." }
        };

        return Ok(ApiResponse<List<RoleCatalogDto>>.Ok(roles));
    }

    [HttpPost("developer/reset-operational-data")]
    [Authorize(Roles = "Developer")]
    public async Task<IActionResult> ResetOperationalData()
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Keep users + masters. Reset only operational/runtime data.
            await _db.ChequeItems.ExecuteDeleteAsync();
            await _db.SlipScans.ExecuteDeleteAsync();
            await _db.SlipEntries.ExecuteDeleteAsync();
            await _db.BatchSlipSequences.ExecuteDeleteAsync();
            await _db.Batches.ExecuteDeleteAsync();
            await _db.BatchSequences.ExecuteDeleteAsync();
            await _db.AuditLogs.ExecuteDeleteAsync();
            await _db.MasterUploadLogs.ExecuteDeleteAsync();

            // Reset identity/sequence counters so new rows start from 1 again.
            await _db.Database.ExecuteSqlRawAsync(@"
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.ChequeItems'))
    DBCC CHECKIDENT ('dbo.ChequeItems', RESEED, 0);
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.SlipScans'))
    DBCC CHECKIDENT ('dbo.SlipScans', RESEED, 0);
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.SlipEntries'))
    DBCC CHECKIDENT ('dbo.SlipEntries', RESEED, 0);
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.BatchSlipSequences'))
    DBCC CHECKIDENT ('dbo.BatchSlipSequences', RESEED, 0);
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.Batches'))
    DBCC CHECKIDENT ('dbo.Batches', RESEED, 0);
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.BatchSequences'))
    DBCC CHECKIDENT ('dbo.BatchSequences', RESEED, 0);
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.AuditLogs'))
    DBCC CHECKIDENT ('dbo.AuditLogs', RESEED, 0);
IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.MasterUploadLogs'))
    DBCC CHECKIDENT ('dbo.MasterUploadLogs', RESEED, 0);
");

            await tx.CommitAsync();
            _logger.LogWarning("Developer reset executed by UserId={UserId}", User.FindFirst("userId")?.Value);
            return Ok(ApiResponse<object>.Ok(new { }, "Operational data reset successfully."));
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Developer reset failed");
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR", "Failed to reset operational data."));
        }
    }
}
