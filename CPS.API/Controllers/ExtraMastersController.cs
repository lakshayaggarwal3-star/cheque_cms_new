// =============================================================================
// File        : ExtraMastersController.cs
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : API endpoints for viewing Internal Bank and Capture Rule masters.
// Created     : 2026-04-25
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/extra-masters")]
[Authorize(Roles = "Scanner,Mobile Scanner,Maker,Checker,Admin,Developer")]
public class ExtraMastersController : ControllerBase
{
    private readonly CpsDbContext _db;

    public ExtraMastersController(CpsDbContext db)
    {
        _db = db;
    }

    [HttpGet("internal-banks")]
    public async Task<IActionResult> GetInternalBanks(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);
        var query = _db.InternalBankMasters.AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var searchTerm = q.ToLower();
            query = query.Where(b => 
                b.EBANK.ToLower().Contains(searchTerm) || 
                b.SORTCODE.ToLower().Contains(searchTerm) || 
                b.NAME.ToLower().Contains(searchTerm) || 
                b.FULLNAME.ToLower().Contains(searchTerm) || 
                b.BRANCH.ToLower().Contains(searchTerm));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(b => b.EBANK)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(ApiResponse<PagedResult<InternalBankMaster>>.Ok(new PagedResult<InternalBankMaster>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        }));
    }

    [HttpGet("capture-rules")]
    public async Task<IActionResult> GetCaptureRules(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);
        var query = _db.ClientCaptureRules.AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var searchTerm = q.ToLower();
            query = query.Where(r => 
                r.CEID.ToLower().Contains(searchTerm) || 
                r.ClientCode.ToLower().Contains(searchTerm) || 
                r.FieldName1.ToLower().Contains(searchTerm) || 
                r.FieldName2.ToLower().Contains(searchTerm) || 
                r.FieldName3.ToLower().Contains(searchTerm) || 
                r.FieldName4.ToLower().Contains(searchTerm) || 
                r.FieldName5.ToLower().Contains(searchTerm));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(r => r.CEID)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(ApiResponse<PagedResult<ClientCaptureRule>>.Ok(new PagedResult<ClientCaptureRule>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        }));
    }
}
