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
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/masters")]
[Authorize(Roles = "Admin,Developer")]
public class MasterUploadController : ControllerBase
{
    private readonly MasterUploadService _uploadService;

    public MasterUploadController(MasterUploadService uploadService) => _uploadService = uploadService;

    [HttpPost("location")]
    public async Task<IActionResult> UploadLocation(IFormFile file)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.UploadLocationAsync(file, userId);
        return Ok(ApiResponse<UploadResultDto>.Ok(result, $"Upload complete: {result.SuccessRows} success, {result.ErrorRows} errors"));
    }

    [HttpPost("client")]
    public async Task<IActionResult> UploadClient(IFormFile file)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.UploadClientAsync(file, userId);
        return Ok(ApiResponse<UploadResultDto>.Ok(result, $"Upload complete: {result.SuccessRows} success, {result.ErrorRows} errors"));
    }

    [HttpPost("preview/location")]
    public async Task<IActionResult> PreviewLocation(IFormFile file)
    {
        var result = await _uploadService.PreviewLocationAsync(file);
        return Ok(ApiResponse<MasterPreviewDto>.Ok(result, "File verified. Review and apply to save all rows in bulk."));
    }

    [HttpPost("preview/client")]
    public async Task<IActionResult> PreviewClient(IFormFile file)
    {
        var result = await _uploadService.PreviewClientAsync(file);
        return Ok(ApiResponse<MasterPreviewDto>.Ok(result, "File verified. Review and apply to save all rows in bulk."));
    }

    [HttpPost("apply/location")]
    public async Task<IActionResult> ApplyLocation([FromBody] MasterApplyRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.ApplyLocationRowsAsync(request.Rows, userId);
        return Ok(ApiResponse<UploadResultDto>.Ok(result, "Location master rows applied in bulk."));
    }

    [HttpPost("apply/client")]
    public async Task<IActionResult> ApplyClient([FromBody] MasterApplyRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _uploadService.ApplyClientRowsAsync(request.Rows, userId);
        return Ok(ApiResponse<UploadResultDto>.Ok(result, "Client master rows applied in bulk."));
    }

    [HttpGet("template/{type}")]
    public IActionResult DownloadTemplate(string type)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Template");

        if (type.ToLower() == "location")
        {
            var headers = new[] { "SrNo", "Grid", "State", "LocationName", "LocationCode",
                "ClusterCode", "Zone", "ScannerID", "BOFD", "PreTrun", "DepositAc", "IFSC", "LocType", "PIFNumber" };
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
}
