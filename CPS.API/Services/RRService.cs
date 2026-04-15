// =============================================================================
// File        : RRService.cs
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : Business logic for MICR error review, repair, approval, and RR completion.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Services;

public class RRService : IRRService
{
    private readonly IScanRepository _scanRepo;
    private readonly IBatchRepository _batchRepo;
    private readonly IAuditService _audit;
    private readonly ILogger<RRService> _logger;

    public RRService(IScanRepository scanRepo, IBatchRepository batchRepo,
        IAuditService audit, ILogger<RRService> logger)
    {
        _scanRepo = scanRepo;
        _batchRepo = batchRepo;
        _audit = audit;
        _logger = logger;
    }

    public async Task<List<RRItemDto>> GetRRItemsAsync(long batchId)
    {
        var items = await _scanRepo.GetRRItemsAsync(batchId);
        return items.Select(MapToDto).ToList();
    }

    public async Task<RRItemDto> GetRRItemAsync(long scanId)
    {
        var item = await _scanRepo.GetByIdAsync(scanId)
            ?? throw new NotFoundException($"Scan item {scanId} not found.");
        return MapToDto(item);
    }

    public async Task<RRItemDto> SaveCorrectionAsync(long scanId, SaveRRCorrectionRequest request, int userId)
    {
        var item = await _scanRepo.GetByIdAsync(scanId)
            ?? throw new NotFoundException($"Scan item {scanId} not found.");

        var old = new { item.ChqNo, item.MICR1, item.MICR2, item.MICR3, item.RRState };

        if (request.Approve)
        {
            item.RRState = (int)RRState.Approved;
        }
        else
        {
            // Validate MICR fields if saving corrections
            if (!string.IsNullOrWhiteSpace(request.ChqNo) && request.ChqNo.Length != 6)
                throw new ValidationException("Cheque number must be exactly 6 digits.");
            if (!string.IsNullOrWhiteSpace(request.MICR1) && request.MICR1.Length != 9)
                throw new ValidationException("MICR1 must be exactly 9 digits.");
            if (!string.IsNullOrWhiteSpace(request.MICR2) && request.MICR2.Length != 6)
                throw new ValidationException("MICR2 must be exactly 6 digits.");

            item.ChqNo = request.ChqNo?.Trim() ?? item.ChqNo;
            item.MICR1 = request.MICR1?.Trim() ?? item.MICR1;
            item.MICR2 = request.MICR2?.Trim() ?? item.MICR2;
            item.MICR3 = request.MICR3?.Trim() ?? item.MICR3;
            item.MICRRepairFlag = BuildRepairFlag(request);
            item.RRState = (int)RRState.Repaired;
        }

        item.RRBy = userId;
        item.RRTime = DateTime.UtcNow;
        item.UpdatedBy = userId;
        item.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _scanRepo.UpdateAsync(item);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("Item was modified by another user. Refresh and try again.");
        }

        await _audit.LogAsync("ScanItems", scanId.ToString(), "UPDATE", old,
            new { item.ChqNo, item.MICR1, item.MICR2, item.RRState }, userId);

        return MapToDto(item);
    }

    public async Task CompleteRRAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (!await _scanRepo.AllRRResolvedAsync(batchId))
            throw new ValidationException("Not all items have been reviewed. Complete all RR items first.");

        batch.BatchStatus = (int)BatchStatus.RRCompleted;
        batch.RRLockedBy = null;
        batch.RRLockedAt = null;
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        _logger.LogInformation("RR completed: BatchNo={BatchNo} by UserID={UserId}", batch.BatchNo, userId);
        await _audit.LogAsync("Batch", batchId.ToString(), "UPDATE",
            new { BatchStatus = (int)BatchStatus.RRPending },
            new { BatchStatus = (int)BatchStatus.RRCompleted }, userId);
    }

    private static string BuildRepairFlag(SaveRRCorrectionRequest r)
    {
        var flags = new List<string>();
        if (!string.IsNullOrWhiteSpace(r.ChqNo)) flags.Add("CHQ");
        if (!string.IsNullOrWhiteSpace(r.MICR1)) flags.Add("M1");
        if (!string.IsNullOrWhiteSpace(r.MICR2)) flags.Add("M2");
        if (!string.IsNullOrWhiteSpace(r.MICR3)) flags.Add("M3");
        return string.Join(",", flags);
    }

    private static RRItemDto MapToDto(ScanItem i)
    {
        var stateLabels = new Dictionary<int, string>
        {
            { 0, "Needs Review" }, { 1, "Approved" }, { 2, "Repaired" }
        };
        return new RRItemDto
        {
            ScanID = i.ScanID,
            BatchID = i.BatchID,
            SeqNo = i.SeqNo,
            IsSlip = i.IsSlip,
            ImageFrontPath = i.ImageFrontPath,
            ImageBackPath = i.ImageBackPath,
            MICRRaw = i.MICRRaw,
            ChqNo = i.ChqNo,
            MICR1 = i.MICR1,
            MICR2 = i.MICR2,
            MICR3 = i.MICR3,
            RRState = i.RRState,
            RRStateLabel = stateLabels.TryGetValue(i.RRState, out var lbl) ? lbl : "Unknown",
            SlipID = i.SlipID,
            SlipNo = i.Slip?.SlipNo,
            ClientName = i.Slip?.ClientName,
            SlipAmount = i.Slip?.SlipAmount,
            TotalInstruments = i.Slip?.TotalInstruments,
            RowVersion = i.RowVersion
        };
    }
}
