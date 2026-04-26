// =============================================================================
// File        : MasterUploadController.cs
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : API endpoints for masters preview/apply, upload, and template download.
// Created     : 2026-04-14
// =============================================================================

using System.Security.Claims;
using ClosedXML.Excel;
using CPS.API.DTOs;
using CPS.API.Models;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/masters")]
[Authorize(Roles = "Admin,Developer")]
public class MasterUploadController : ControllerBase
{
    private readonly MasterUploadService _uploadService;
    private readonly CpsDbContext _db;

    public MasterUploadController(MasterUploadService uploadService, CpsDbContext db)
    {
        _uploadService = uploadService;
        _db = db;
    }

    [HttpPost("location")]
    public async Task<IActionResult> UploadLocation(IFormFile file)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.CreateUploadJobAsync(file, "Location", userId);
        return Ok(ApiResponse<JobStartDto>.Ok(result, "Location upload queued."));
    }

    [HttpPost("client")]
    public async Task<IActionResult> UploadClient(IFormFile file)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.CreateUploadJobAsync(file, "Client", userId);
        return Ok(ApiResponse<JobStartDto>.Ok(result, "Client upload queued."));
    }

    [HttpPost("internal-bank")]
    public async Task<IActionResult> UploadInternalBank(IFormFile file)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.CreateUploadJobAsync(file, "internal-bank", userId);
        return Ok(ApiResponse<JobStartDto>.Ok(result, "RCMS Bank Code upload queued."));
    }

    [HttpPost("capture-rule")]
    public async Task<IActionResult> UploadCaptureRule(IFormFile file)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.CreateUploadJobAsync(file, "capture-rule", userId);
        return Ok(ApiResponse<JobStartDto>.Ok(result, "Enrichment Master upload queued."));
    }


    [HttpPost("preview/internal-bank")]
    public async Task<IActionResult> PreviewInternalBank(IFormFile file)
    {
        var result = await _uploadService.PreviewInternalBankAsync(file);
        return Ok(ApiResponse<MasterPreviewDto>.Ok(result, "File verified. Review and apply to save all rows in bulk."));
    }

    [HttpPost("preview/capture-rule")]
    public async Task<IActionResult> PreviewCaptureRule(IFormFile file)
    {
        var result = await _uploadService.PreviewCaptureRuleAsync(file);
        return Ok(ApiResponse<MasterPreviewDto>.Ok(result, "File verified. Review and apply to save all rows in bulk."));
    }


    [HttpGet("template/{type}")]
    public IActionResult DownloadTemplate(string type)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Template");

        if (type.ToLower() == "location")
        {
            var headers = new[] { "SrNo", "Grid", "State", "LocationName", "Location Code",
                "Cluster CODE", "Zone", "ScannerID", "BOFD", "PreTrun", "DepositAc", "IFSC", "LocType", "PIF Number" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
        }
        else if (type.ToLower() == "client")
        {
            var headers = new[] { "CITY_CODE", "NAME", "ADDRESS1", "ADDRESS2", "ADDRESS3",
                "ADDRESS4", "ADDRESS5", "PICKUP_POINT_CODE", "PICKUPPOINT_DESCRIPTION", "RCMS_CODE", "STATUS", "STATUS_DATE" };

            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
        }
        else if (type.ToLower() == "internal-bank")
        {
            var headers = new[] { "EBANK", "SORTCODE", "NAME", "FULLNAME", "BRANCH" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
        }
        else if (type.ToLower() == "capture-rule")
        {
            var headers = new[] { "CEID", "ClientCode", "FieldName1", "FieldName2", "FieldName3", "FieldName4", "FieldName5" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
            }
        }
        else
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Unknown template type."));
        }

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        stream.Position = 0;
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"{type}_template.xlsx");
    }

    [HttpPost("scb-master")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> UploadScbMaster(IFormFile file)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.CreateUploadJobAsync(file, "scb-master", userId);
        return Ok(ApiResponse<JobStartDto>.Ok(result, "Clearing House Master upload queued."));
    }

    [HttpGet("export/{type}")]
    public async Task<IActionResult> ExportMaster(string type)
    {
        byte[] data;
        if (type.ToLower() == "scb-master")
        {
            var section = Request.Query["section"].ToString() ?? "Bank";
            var scbService = HttpContext.RequestServices.GetRequiredService<IScbMasterService>();
            data = await scbService.ExportToExcelAsync(section);
        }
        else
        {
            data = await _uploadService.ExportMasterToExcelAsync(type.ToLower());
        }
        
        return File(data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"{type}_export_{DateTime.Now:yyyyMMdd}.xlsx");
    }

    [HttpPost("clear/{type}")]
    public async Task<IActionResult> ClearMaster(string type)
    {
        string t = type.ToLower();
        if (t == "client") await _db.Database.ExecuteSqlRawAsync("DELETE FROM Clients");
        else if (t == "location") await _db.Database.ExecuteSqlRawAsync("DELETE FROM Locations");
        else if (t == "internal-bank") await _db.Database.ExecuteSqlRawAsync("DELETE FROM InternalBankMasters");
        else if (t == "capture-rule") await _db.Database.ExecuteSqlRawAsync("DELETE FROM ClientCaptureRules");
        else if (t == "scb-master")
        {
            var section = Request.Query["section"].ToString();
            var scbService = HttpContext.RequestServices.GetRequiredService<IScbMasterService>();
            if (string.IsNullOrEmpty(section))
                await scbService.ClearDataAsync();
            else
                await scbService.ClearSectionAsync(section);
        }
        else return BadRequest(ApiResponse<string>.Fail("NOT_SUPPORTED", "Clear not supported for this type."));

        return Ok(ApiResponse<string>.Ok($"{type} master data cleared."));
    }
}
