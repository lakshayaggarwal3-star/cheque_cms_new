// =============================================================================
// File        : SlipController.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : API endpoints for slip creation, update, and listing within a batch.
// Created     : 2026-04-14
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/slip")]
[Authorize]
public class SlipController : ControllerBase
{
    private readonly ISlipService _slipService;

    public SlipController(ISlipService slipService) => _slipService = slipService;

    [HttpGet("{batchId:long}")]
    public async Task<IActionResult> GetByBatch(long batchId)
    {
        var slips = await _slipService.GetByBatchAsync(batchId);
        return Ok(ApiResponse<List<SlipDto>>.Ok(slips));
    }

    [HttpPost]
    [Authorize(Roles = "Scanner,MobileScanner,Admin,Developer")]
    public async Task<IActionResult> Create([FromBody] CreateSlipRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _slipService.CreateSlipAsync(request, userId);
        return StatusCode(201, ApiResponse<SlipDto>.Ok(result, "Slip created"));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Scanner,MobileScanner,Admin,Developer")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSlipRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var result = await _slipService.UpdateSlipAsync(id, request, userId);
        return Ok(ApiResponse<SlipDto>.Ok(result));
    }

    [HttpGet("autofill/{clientCode}")]
    public async Task<IActionResult> AutoFill(string clientCode)
    {
        var locationId = int.Parse(User.FindFirstValue("locationId") ?? "0");
        var result = await _slipService.GetClientAutoFillAsync(clientCode, locationId);
        if (result == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Client not found or not applicable to your location."));
        return Ok(ApiResponse<ClientAutoFillDto>.Ok(result));
    }

    [HttpGet("clients-by-location")]
    public async Task<IActionResult> GetClientsByLocation()
    {
        var locationId = int.Parse(User.FindFirstValue("locationId") ?? "0");
        var result = await _slipService.GetClientsByLocationAsync(locationId);
        return Ok(ApiResponse<List<ClientAutoFillDto>>.Ok(result));
    }

    [HttpPost("generate-slip-no/{batchId:long}")]
    [Authorize(Roles = "Scanner,MobileScanner,Admin,Developer")]
    public async Task<IActionResult> GenerateSlipNo(long batchId)
    {
        var result = await _slipService.GenerateNextSlipNoAsync(batchId);
        return Ok(ApiResponse<object>.Ok(new { slipNo = result }));
    }
}
