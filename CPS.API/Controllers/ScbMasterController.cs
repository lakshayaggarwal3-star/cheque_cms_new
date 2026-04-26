// =============================================================================
// File        : ScbMasterController.cs
// Project     : CPS — Cheque Processing System
// Module      : SCB Master
// Description : API endpoints for SCB Master data status and XML bulk upload.
// Created     : 2026-04-25
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/scb-master")]
[Authorize(Roles = "Admin,Developer")]
public class ScbMasterController : ControllerBase
{
    private readonly IScbMasterService _scbMasterService;

    public ScbMasterController(IScbMasterService scbMasterService)
    {
        _scbMasterService = scbMasterService;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var status = await _scbMasterService.GetStatusAsync();
        return Ok(ApiResponse<List<ScbMasterStatusDto>>.Ok(status));
    }

    [HttpGet("data/{section}")]
    public async Task<IActionResult> GetData(string section, [FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var result = await _scbMasterService.GetSectionDataAsync(section, q, page, pageSize);
        return Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost("upload")]
    [DisableRequestSizeLimit] // XML files can be very large
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("INVALID_FILE", "No file uploaded."));

        if (!file.FileName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse<object>.Fail("INVALID_TYPE", "Only XML files are supported."));

        var userId = int.Parse(User.FindFirstValue("userId")!);
        
        using var stream = file.OpenReadStream();
        var result = await _scbMasterService.UploadXmlAsync(stream, userId);

        if (!result.Success)
            return StatusCode(500, ApiResponse<ScbUploadResultDto>.Ok(result, "Upload failed."));

        return Ok(ApiResponse<ScbUploadResultDto>.Ok(result, "Upload successful."));
    }

}
