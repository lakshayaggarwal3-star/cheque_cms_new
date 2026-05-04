// =============================================================================
// File        : ChequeController.cs
// Project     : CPS — Cheque Processing System
// Module      : Maker
// Description : Cheque item endpoints for Maker data entry.
// Created     : 2026-05-03
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Models;
using CPS.API.Repositories;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/cheque")]
[Authorize]
public class ChequeController : ControllerBase
{
    private readonly CpsDbContext _db;
    private readonly IAuditService _audit;
    private readonly IScanService _scanService;

    public ChequeController(CpsDbContext db, IAuditService audit, IScanService scanService)
    {
        _db = db;
        _audit = audit;
        _scanService = scanService;
    }

    [HttpGet("batch/{batchId:long}")]
    public async Task<IActionResult> GetByBatch(long batchId)
    {
        var cheques = await _db.ChequeItems
            .Where(c => c.BatchId == batchId && !c.IsDeleted)
            .OrderBy(c => c.SeqNo)
            .ToListAsync();

        var dtos = cheques.Select(c => new ChequeItemDto
        {
            ChequeItemId = c.ChequeItemId,
            SlipEntryId = c.SlipEntryId,
            BatchId = c.BatchId,
            SeqNo = c.SeqNo,
            ChqSeq = c.ChqSeq,
            ChqNo = c.ChqNo,
            ScanChqNo = c.ScanChqNo,
            RRChqNo = c.RRChqNo,
            MICRRaw = c.MICRRaw,
            ScanMICRRaw = c.ScanMICRRaw,
            MICR1 = c.MICR1,
            MICR2 = c.MICR2,
            MICR3 = c.MICR3,
            ScanMICR1 = c.ScanMICR1,
            ScanMICR2 = c.ScanMICR2,
            ScanMICR3 = c.ScanMICR3,
            RRMICR1 = c.RRMICR1,
            RRMICR2 = c.RRMICR2,
            RRMICR3 = c.RRMICR3,
            RRNotes = c.RRNotes,
            RRState = c.RRState,
            ScanStatus = c.ScanStatus,
            RetryCount = c.RetryCount,
            ImageBaseName = c.ImageBaseName,
            ImageName = c.ImageName,
            FileExtension = c.FileExtension,
            ImageHash = c.ImageHash,
            MakerAmount = c.MakerAmount,
            MakerBeneficiary = c.MakerBeneficiary,
            MakerDate = c.MakerDate?.ToString("yyyy-MM-dd"),
            CheckerAmount = c.CheckerAmount,
            CheckerBeneficiary = c.CheckerBeneficiary,
            CheckerDate = c.CheckerDate?.ToString("yyyy-MM-dd"),
            Amount = c.Amount,
        });

        return Ok(ApiResponse<IEnumerable<ChequeItemDto>>.Ok(dtos));
    }

    [HttpPut("{id:long}/maker")]
    [Authorize(Roles = "Maker,Admin,Developer")]
    public async Task<IActionResult> UpdateMaker(long id, [FromBody] MakerEntryRequest request)
    {
        var cheque = await _db.ChequeItems
            .Include(c => c.Batch)
            .FirstOrDefaultAsync(c => c.ChequeItemId == id && !c.IsDeleted);

        if (cheque == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Cheque item not found."));

        var userId = int.Parse(User.FindFirstValue("userId")!);

        cheque.MakerAmount = request.Amount;
        cheque.MakerBeneficiary = request.Beneficiary?.Trim();
        if (DateOnly.TryParse(request.Date, out var d)) cheque.MakerDate = d;

        if (!string.IsNullOrEmpty(request.Micr1)) cheque.MICR1 = request.Micr1.Trim();
        if (!string.IsNullOrEmpty(request.Micr2)) cheque.MICR2 = request.Micr2.Trim();
        if (!string.IsNullOrEmpty(request.Micr3)) cheque.MICR3 = request.Micr3.Trim();
        if (!string.IsNullOrEmpty(request.ChqNo)) cheque.ChqNo = request.ChqNo.Trim();

        cheque.MakerState = request.Complete ? (int)MakerState.Completed : (int)MakerState.InProgress;
        if (request.Complete)
        {
            cheque.MakerCompletedBy = userId;
            cheque.MakerCompletedAt = DateTime.UtcNow;
        }
        cheque.UpdatedBy = userId;
        cheque.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _audit.LogAsync("ChequeItem", id.ToString(), "MAKER_ENTRY", null, request, userId, batchNo: cheque.Batch.BatchNo);
        return Ok(ApiResponse<object>.Ok(new { }, "Maker entry saved"));
    }

    [HttpPost("map-to-slip")]
    [Authorize(Roles = "Maker,Admin,Developer")]
    public async Task<IActionResult> MapToSlip([FromBody] MapToSlipRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        
        // Find batch ID from either a cheque or a slip item in the request
        long batchId = 0;
        if (request.ChequeItemIds.Any())
        {
            batchId = await _db.ChequeItems.Where(c => c.ChequeItemId == request.ChequeItemIds[0]).Select(c => c.BatchId).FirstOrDefaultAsync();
        }
        else if (request.SlipItemIds.Any())
        {
            batchId = await _db.SlipItems.Where(s => s.SlipItemId == request.SlipItemIds[0]).Include(s => s.SlipEntry).Select(s => s.SlipEntry.BatchId).FirstOrDefaultAsync();
        }

        if (batchId == 0) return BadRequest(ApiResponse<object>.Fail("INVALID", "No images selected for mapping."));

        await _scanService.MapImagesToSlipAsync(batchId, request.ChequeItemIds, request.SlipItemIds, request.SlipEntryId, userId);

        return Ok(ApiResponse<object>.Ok(new { }, "Images mapped and relocated successfully."));
    }
}

public class MapToSlipRequest
{
    public List<long> ChequeItemIds { get; set; } = new();
    public List<long> SlipItemIds { get; set; } = new();
    public long SlipEntryId { get; set; }
}

public class MakerEntryRequest
{
    public decimal Amount { get; set; }
    public string Beneficiary { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string? Micr1 { get; set; }
    public string? Micr2 { get; set; }
    public string? Micr3 { get; set; }
    public string? ChqNo { get; set; }
    public bool Complete { get; set; }
    public string RowVersion { get; set; } = string.Empty;
}
