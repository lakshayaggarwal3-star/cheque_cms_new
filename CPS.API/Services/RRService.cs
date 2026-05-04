// =============================================================================
// File        : RRService.cs
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : Business logic for MICR error review, repair, approval, and RR completion.
// Created     : 2026-04-17
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Services;

public class RRService : IRRService
{
    private readonly ISlipEntryRepository _slipRepo;
    private readonly IBatchRepository _batchRepo;
    private readonly IAuditService _audit;
    private readonly ILogger<RRService> _logger;
    private static readonly TimeSpan STALE_RR_LOCK_TIMEOUT = TimeSpan.FromMinutes(7);

    public RRService(ISlipEntryRepository slipRepo, IBatchRepository batchRepo,
        IAuditService audit, ILogger<RRService> logger)
    {
        _slipRepo = slipRepo;
        _batchRepo = batchRepo;
        _audit = audit;
        _logger = logger;
    }

    public async Task<List<RRItemDto>> GetRRItemsAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        // Block if another user holds a fresh RR lock
        if (batch.RRLockedBy.HasValue && batch.RRLockedBy != userId)
        {
            var isStale = batch.RRLockedAt.HasValue &&
                          DateTime.UtcNow - batch.RRLockedAt.Value > STALE_RR_LOCK_TIMEOUT;
            if (!isStale)
                throw new ConflictException("This batch is currently being worked on by another user in RR.");

            // Stale lock: record previous user's release before taking over
            var previousUserId = batch.RRLockedBy.Value;
            batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "RRReleased", previousUserId, "Stale lock auto-released");
        }

        var isFirstRR = !batch.RRStartedAt.HasValue;
        if (isFirstRR)
        {
            batch.RRStartedAt = DateTime.UtcNow;
            batch.RRStartedBy = userId;
            batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "RRStarted", userId);
        }
        else if (batch.RRLockedBy != userId)
        {
            // A different user is taking over (after stale release above) or locking for first time
            batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "RRLocked", userId);
        }

        batch.RRLockedBy = userId;
        batch.RRLockedAt = DateTime.UtcNow;
        batch.BatchStatus = (int)BatchStatus.RRInProgress;
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;
        await _batchRepo.UpdateAsync(batch);

        var cheques = await _slipRepo.GetChequeItemsByBatchAsync(batchId);
        var result = new List<RRItemDto>();
        foreach (var c in cheques)
        {
            var slip = await _slipRepo.GetByIdAsync(c.SlipEntryId);
            result.Add(MapToDto(c, slip));
        }
        return result;
    }

    public async Task ReleaseRRLockAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        // Only the lock holder (or Admin/Dev) should release — service layer trusts controller to enforce role
        if (batch.BatchStatus == (int)BatchStatus.RRInProgress)
            batch.BatchStatus = (int)BatchStatus.RRPending;

        batch.RRLockedBy = null;
        batch.RRLockedAt = null;
        batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "RRReleased", userId);
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;
        await _batchRepo.UpdateAsync(batch);

        _logger.LogInformation("RR lock released: BatchNo={BatchNo} by UserID={UserId}", batch.BatchNo, userId);
    }

    public async Task HeartbeatAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (batch.RRLockedBy != userId)
            throw new ForbiddenException("You do not hold the RR lock for this batch.");

        batch.RRLockedAt = DateTime.UtcNow;
        batch.UpdatedAt  = DateTime.UtcNow;
        await _batchRepo.UpdateAsync(batch);
    }

    public async Task<RRItemDto> GetRRItemAsync(long chequeItemId)
    {
        var item = await _slipRepo.GetChequeItemByIdAsync(chequeItemId)
            ?? throw new NotFoundException($"Cheque item {chequeItemId} not found.");
        var slip = await _slipRepo.GetByIdAsync(item.SlipEntryId);
        return MapToDto(item, slip);
    }

    public async Task<RRItemDto> SaveCorrectionAsync(long chequeItemId, SaveRRCorrectionRequest request, int userId)
    {
        var item = await _slipRepo.GetChequeItemByIdAsync(chequeItemId)
            ?? throw new NotFoundException($"Cheque item {chequeItemId} not found.");

        var old = new { item.ChqNo, item.ScanMICR1, item.ScanMICR2, item.ScanMICR3, item.RRState };

        if (request.Approve)
        {
            item.RRState = (int)RRState.Approved;
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(request.ChqNo) && request.ChqNo.Length != 6)
                throw new ValidationException("Cheque number must be exactly 6 digits.");
            if (!string.IsNullOrWhiteSpace(request.RRMICR1) && request.RRMICR1.Length != 9)
                throw new ValidationException("MICR1 must be exactly 9 digits.");
            if (!string.IsNullOrWhiteSpace(request.RRMICR2) && request.RRMICR2.Length != 6)
                throw new ValidationException("MICR2 must be exactly 6 digits.");

            // Store corrections in RR fields — never overwrite ScanMICR fields
            item.RRChqNo = request.RRChqNo?.Trim();
            item.ChqNo = item.RRChqNo ?? item.ScanChqNo ?? item.ChqNo; // Update main display field

            item.RRMICR1 = request.RRMICR1?.Trim();
            item.RRMICR2 = request.RRMICR2?.Trim();
            item.RRMICR3 = request.RRMICR3?.Trim();

            // Sync final display fields
            item.MICR1 = item.RRMICR1 ?? item.ScanMICR1;
            item.MICR2 = item.RRMICR2 ?? item.ScanMICR2;
            item.MICR3 = item.RRMICR3 ?? item.ScanMICR3;

            item.RRNotes = request.RRNotes?.Trim();
            item.RRState = (int)RRState.Repaired;
        }

        // Apply RowVersion from request to enable optimistic concurrency check
        item.RowVersion = request.RowVersion;

        item.RRCompletedBy = userId;
        item.RRCompletedAt = DateTime.UtcNow;
        item.UpdatedBy = userId;
        item.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _slipRepo.UpdateChequeItemAsync(item);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("Item was modified by another user. Refresh and try again.");
        }

        var batch = await _batchRepo.GetByIdAsync(item.BatchId);
        await _audit.LogAsync("ChequeItem", chequeItemId.ToString(), request.Approve ? "APPROVE" : "REPAIR", 
            old, new { item.ChqNo, item.RRChqNo, item.MICR1, item.MICR2, item.MICR3, item.RRMICR1, item.RRMICR2, item.RRMICR3, item.RRNotes, item.RRState }, 
            userId, batchNo: batch?.BatchNo);

        var slip = await _slipRepo.GetByIdAsync(item.SlipEntryId);
        return MapToDto(item, slip);
    }

    public async Task CompleteRRAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (!await _slipRepo.AllRRResolvedAsync(batchId))
            throw new ValidationException("Not all items have been reviewed. Complete all RR items first.");

        batch.BatchStatus = (int)BatchStatus.RRCompleted;
        batch.RRCompletedBy = userId;
        batch.RRCompletedAt = DateTime.UtcNow;
        batch.RRLockedBy = null;
        batch.RRLockedAt = null;
        batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "RRCompleted", userId);
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        _logger.LogInformation("RR completed: BatchNo={BatchNo} by UserID={UserId}", batch.BatchNo, userId);
        await _audit.LogAsync("Batch", batchId.ToString(), "UPDATE",
            new { BatchStatus = (int)BatchStatus.RRInProgress },
            new { BatchStatus = (int)BatchStatus.RRCompleted }, userId);
    }

    private static RRItemDto MapToDto(ChequeItem c, SlipEntry? slip)
    {
        var stateLabels = new Dictionary<int, string>
        {
            { 0, "Needs Review" }, { 1, "Approved" }, { 2, "Repaired" }
        };
        return new RRItemDto
        {
            ChequeItemId = c.ChequeItemId,
            BatchId = c.BatchId,
            SlipEntryId = c.SlipEntryId,
            SeqNo = c.SeqNo,
            ChqSeq = c.ChqSeq,
            ImageBaseName = c.ImageBaseName,
            FileExtension = c.FileExtension,
            MICRRaw = c.MICRRaw,
            ScanMICRRaw = c.ScanMICRRaw,
            MICR1 = c.MICR1,
            MICR2 = c.MICR2,
            MICR3 = c.MICR3,
            ChqNo = c.ChqNo,
            ScanChqNo = c.ScanChqNo,
            RRChqNo = c.RRChqNo,
            ScanMICR1 = c.ScanMICR1,
            ScanMICR2 = c.ScanMICR2,
            ScanMICR3 = c.ScanMICR3,
            RRMICR1 = c.RRMICR1,
            RRMICR2 = c.RRMICR2,
            RRMICR3 = c.RRMICR3,
            RRNotes = c.RRNotes,
            RRState = c.RRState,
            RRStateLabel = stateLabels.TryGetValue(c.RRState, out var lbl) ? lbl : "Unknown",
            SlipNo = slip?.SlipNo,
            ClientName = slip?.ClientName,
            SlipAmount = slip?.SlipAmount,
            TotalInstruments = slip?.TotalInstruments,
            RowVersion = c.RowVersion
        };
    }
}
