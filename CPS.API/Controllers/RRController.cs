// =============================================================================
// File        : RRController.cs
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : API endpoints for listing RR items, saving corrections, and completing RR.
// Created     : 2026-04-17
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/rr")]
[Authorize(Roles = "Maker,Checker,Admin,Developer")]
public class RRController : ControllerBase
{
    private readonly IRRService _rrService;

    public RRController(IRRService rrService) => _rrService = rrService;

    [HttpGet("{batchId:long}")]
    public async Task<IActionResult> GetItems(long batchId)
    {
        var items = await _rrService.GetRRItemsAsync(batchId);
        return Ok(ApiResponse<List<RRItemDto>>.Ok(items));
    }

    [HttpGet("item/{chequeItemId:long}")]
    public async Task<IActionResult> GetItem(long chequeItemId)
    {
        var item = await _rrService.GetRRItemAsync(chequeItemId);
        return Ok(ApiResponse<RRItemDto>.Ok(item));
    }

    [HttpPut("item/{chequeItemId:long}")]
    public async Task<IActionResult> SaveCorrection(long chequeItemId, [FromBody] SaveRRCorrectionRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _rrService.SaveCorrectionAsync(chequeItemId, request, userId);
        return Ok(ApiResponse<RRItemDto>.Ok(result));
    }

    [HttpPost("{batchId:long}/complete")]
    public async Task<IActionResult> Complete(long batchId)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _rrService.CompleteRRAsync(batchId, userId);
        return Ok(ApiResponse<object>.Ok(null, "RR completed"));
    }
}
