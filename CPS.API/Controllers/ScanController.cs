// =============================================================================
// File        : ScanController.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : API endpoints for scan session management, cheque saving, and scan completion.
// Created     : 2026-04-14
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/scan")]
[Authorize(Roles = "Scanner,MobileScanner,Admin,Developer")]
public class ScanController : ControllerBase
{
    private readonly IScanService _scanService;

    public ScanController(IScanService scanService) => _scanService = scanService;

    [HttpGet("{batchId:long}")]
    public async Task<IActionResult> GetSession(long batchId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.GetSessionAsync(batchId, userId);
        return Ok(ApiResponse<ScanSessionDto>.Ok(result));
    }

    [HttpPost("{batchId:long}/start")]
    public async Task<IActionResult> Start(long batchId, [FromBody] StartScanRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.StartScanAsync(batchId, request, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Scanning started"));
    }

    [HttpPost("{batchId:long}/feed/start")]
    public async Task<IActionResult> StartFeed(long batchId, [FromBody] ScannerFeedRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.StartFeedAsync(batchId, request, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Feed started"));
    }

    [HttpPost("{batchId:long}/feed/stop")]
    public async Task<IActionResult> StopFeed(long batchId, [FromBody] ScannerFeedRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.StopFeedAsync(batchId, request, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Feed stopped"));
    }

    [HttpPost("{batchId:long}/capture")]
    public async Task<IActionResult> Capture(long batchId, [FromBody] CaptureScanRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.CaptureAsync(batchId, request, userId);
        return StatusCode(201, ApiResponse<ScanItemDto>.Ok(result, "Capture saved"));
    }

    [HttpPost("{batchId:long}/upload-mobile")]
    [RequestSizeLimit(25_000_000)]
    public async Task<IActionResult> UploadMobile(long batchId, [FromForm] MobileUploadScanRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.UploadMobileCaptureAsync(batchId, request, userId);
        return StatusCode(201, ApiResponse<ScanItemDto>.Ok(result, "Mobile capture saved"));
    }

    [HttpPost("{batchId:long}/save-cheque")]
    public async Task<IActionResult> SaveCheque(long batchId, [FromBody] SaveChequeRequest request)
    {
        request.BatchID = batchId;
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.SaveChequeAsync(request, userId);
        return StatusCode(201, ApiResponse<ScanItemDto>.Ok(result));
    }

    [HttpPost("{batchId:long}/complete")]
    public async Task<IActionResult> Complete(long batchId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.CompleteScanAsync(batchId, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Scanning completed"));
    }

    [HttpPost("{batchId:long}/release-lock")]
    public async Task<IActionResult> ReleaseLock(long batchId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.ReleaseLockAsync(batchId, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Lock released"));
    }
}
