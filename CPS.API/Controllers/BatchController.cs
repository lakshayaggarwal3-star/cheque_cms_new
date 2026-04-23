// =============================================================================
// File        : BatchController.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : API endpoints for batch creation, listing, status update, and dashboard.
// Created     : 2026-04-14
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/batch")]
[Authorize(Roles = "Scanner,MobileScanner,Maker,Checker,Admin,Developer")]
public class BatchController : ControllerBase
{
    private readonly IBatchService _batchService;

    public BatchController(IBatchService batchService) => _batchService = batchService;

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] int? locationId,
        [FromQuery] string? date,
        [FromQuery] int? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        DateOnly? parsedDate = null;
        if (!string.IsNullOrEmpty(date) && DateOnly.TryParse(date, out var d))
            parsedDate = d;

        var result = await _batchService.GetBatchListAsync(locationId, parsedDate, status, page, pageSize);
        return Ok(ApiResponse<PagedResult<BatchDto>>.Ok(result));
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id)
    {
        var result = await _batchService.GetBatchAsync(id);
        return Ok(ApiResponse<BatchDto>.Ok(result));
    }

    [HttpGet("by-number/{batchNo}")]
    public async Task<IActionResult> GetByNumber(string batchNo)
    {
        var result = await _batchService.GetBatchByNumberAsync(batchNo);
        return Ok(ApiResponse<BatchDto>.Ok(result));
    }

    [HttpPost]
    [Authorize(Roles = "Scanner,MobileScanner,Admin,Developer")]
    public async Task<IActionResult> Create([FromBody] CreateBatchRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _batchService.CreateBatchAsync(request, userId);
        return StatusCode(201, ApiResponse<BatchDto>.Ok(result, "Batch created successfully"));
    }

    [HttpPut("{id:long}")]
    [Authorize(Roles = "Scanner,MobileScanner,Admin,Developer")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateBatchRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _batchService.UpdateBatchAsync(id, request, userId);
        return Ok(ApiResponse<BatchDto>.Ok(result, "Batch updated successfully"));
    }

    [HttpPut("{id:long}/status")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> UpdateStatus(long id, [FromBody] UpdateBatchStatusRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _batchService.UpdateStatusAsync(id, request, userId);
        return Ok(ApiResponse<object>.Ok(new { }, "Status updated"));
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard([FromQuery] int locationId, [FromQuery] string? date)
    {
        var today = string.IsNullOrEmpty(date)
            ? DateOnly.FromDateTime(DateTime.Today)
            : DateOnly.Parse(date);
        var result = await _batchService.GetDashboardAsync(locationId, today);
        return Ok(ApiResponse<DashboardSummary>.Ok(result));
    }
}
