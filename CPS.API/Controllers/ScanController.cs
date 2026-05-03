// =============================================================================
// File        : ScanController.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : API endpoints for scan session, slip scan images, and cheque capture.
// Created     : 2026-04-17
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/scan")]
[Authorize]
public class ScanController : ControllerBase
{
    private readonly IScanService _scanService;

    public ScanController(IScanService scanService) => _scanService = scanService;

    // ─── Session ─────────────────────────────────────────────────────────────

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

    // ─── Slip item images ─────────────────────────────────────────────────────

    [HttpPost("{batchId:long}/slip-item/capture")]
    public async Task<IActionResult> CaptureSlipItem(long batchId, [FromBody] CaptureSlipItemRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.CaptureSlipItemAsync(batchId, request, userId);
        return StatusCode(201, ApiResponse<SlipItemDto>.Ok(result, "Slip item saved"));
    }

    [HttpPost("{batchId:long}/slip-item/upload-mobile")]
    [RequestSizeLimit(15_000_000)]
    public async Task<IActionResult> UploadMobileSlipItem(long batchId, [FromForm] MobileUploadSlipItemRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.UploadMobileSlipItemAsync(batchId, request, userId);
        return StatusCode(201, ApiResponse<SlipItemDto>.Ok(result, "Slip item uploaded"));
    }

    [HttpPost("{batchId:long}/slip-item/upload-bulk")]
    [RequestSizeLimit(100_000_000)]
    public async Task<IActionResult> UploadBulkSlipItems(long batchId, [FromForm] BulkSlipItemUploadRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var results = await _scanService.UploadBulkSlipItemsAsync(batchId, request, userId);
        return StatusCode(201, ApiResponse<List<SlipItemDto>>.Ok(results, $"{results.Count} slip item(s) uploaded"));
    }


    // ─── Cheque capture ───────────────────────────────────────────────────────

    [HttpPost("{batchId:long}/cheque/capture")]
    public async Task<IActionResult> CaptureChecque(long batchId, [FromBody] CaptureChequeRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.CaptureChequeAsync(batchId, request, userId);
        return StatusCode(201, ApiResponse<ChequeItemDto>.Ok(result, "Cheque captured"));
    }

    [HttpPost("{batchId:long}/cheque/save")]
    public async Task<IActionResult> SaveCheque(long batchId, [FromBody] SaveChequeItemRequest request)
    {
        request.BatchId = batchId;
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.SaveChequeItemAsync(request, userId);
        return StatusCode(201, ApiResponse<ChequeItemDto>.Ok(result));
    }

    [HttpPost("{batchId:long}/cheque/upload-mobile")]
    [RequestSizeLimit(25_000_000)]
    public async Task<IActionResult> UploadMobileCheque(long batchId, [FromForm] MobileUploadChequeRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _scanService.UploadMobileChequeAsync(batchId, request, userId);
        return StatusCode(201, ApiResponse<ChequeItemDto>.Ok(result, "Cheque uploaded"));
    }

    // ─── Complete / Release ───────────────────────────────────────────────────

    [HttpPost("{batchId:long}/slip/{slipEntryId:long}/complete-slip")]
    public async Task<IActionResult> CompleteSlipPhase(long batchId, long slipEntryId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.UpdateSlipStatusAsync(batchId, slipEntryId, CPS.API.Models.SlipStatus.SlipScanned, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Slip scanning phase completed"));
    }

    [HttpPost("{batchId:long}/slip/{slipEntryId:long}/complete-cheque")]
    public async Task<IActionResult> CompleteChequePhase(long batchId, long slipEntryId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.UpdateSlipStatusAsync(batchId, slipEntryId, CPS.API.Models.SlipStatus.Complete, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Cheque scanning phase completed"));
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

    [HttpPost("{batchId:long}/heartbeat")]
    public async Task<IActionResult> Heartbeat(long batchId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.HeartbeatAsync(batchId, userId);
        return Ok(ApiResponse<object>.Ok(new { }));
    }

    [HttpPost("{batchId:long}/reopen")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> ReopenBatch(long batchId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _scanService.ReopenBatchAsync(batchId, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Batch reopened for scanning"));
    }
}
