// =============================================================================
// File        : ScanService.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Manages scan session, slip scan images, cheque capture, and resume state.
// Created     : 2026-04-17
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;
using Microsoft.AspNetCore.Http;

namespace CPS.API.Services;

public class ScanService : IScanService
{
    private readonly IBatchRepository _batchRepo;
    private readonly ISlipEntryRepository _slipRepo;
    private readonly IUserRepository _userRepo;
    private readonly IScannerOrchestrator _scanner;
    private readonly IImageStorageConfig _imageStorageConfig;
    private readonly IAuditService _audit;
    private readonly ILogger<ScanService> _logger;
    private static readonly TimeSpan STALE_LOCK_TIMEOUT = TimeSpan.FromMinutes(30);

    public ScanService(IBatchRepository batchRepo, ISlipEntryRepository slipRepo,
        IUserRepository userRepo, IScannerOrchestrator scanner,
        IImageStorageConfig imageStorageConfig, IAuditService audit, ILogger<ScanService> logger)
    {
        _batchRepo = batchRepo;
        _slipRepo = slipRepo;
        _userRepo = userRepo;
        _scanner = scanner;
        _imageStorageConfig = imageStorageConfig;
        _audit = audit;
        _logger = logger;
    }

    public async Task<ScanSessionDto> GetSessionAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        var slipGroups = await _slipRepo.GetByBatchAsync(batchId);

        var totalCheques = slipGroups.Sum(s => s.ChequeItems.Count(c => !c.IsDeleted));
        var resumeState = BuildResumeState(slipGroups, batch.WithSlip ?? false);

        return new ScanSessionDto
        {
            BatchId = batch.BatchID,
            BatchNo = batch.BatchNo,
            BatchStatus = batch.BatchStatus,
            WithSlip = batch.WithSlip,
            ScanType = batch.ScanType,
            ScanLockedBy = batch.ScanLockedBy,
            TotalCheques = totalCheques,
            TotalSlipEntries = slipGroups.Count,
            TotalAmount = slipGroups.Sum(s => s.SlipAmount),
            SlipGroups = slipGroups.Select(SlipService.MapToDto).ToList(),
            ResumeState = resumeState
        };
    }

    public async Task StartScanAsync(long batchId, StartScanRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (!string.Equals(request.ScanType, "Scan", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.ScanType, "Rescan", StringComparison.OrdinalIgnoreCase))
            throw new ValidationException("ScanType must be 'Scan' or 'Rescan'.");

        if (batch.ScanLockedBy.HasValue && batch.ScanLockedBy != userId)
        {
            var isStale = batch.ScanLockedAt.HasValue &&
                          DateTime.UtcNow - batch.ScanLockedAt.Value > STALE_LOCK_TIMEOUT;
            if (!isStale)
                throw new ConflictException("Batch is currently being scanned by another user.");
        }

        batch.ScanLockedBy = userId;
        batch.ScanLockedAt = DateTime.UtcNow;
        batch.BatchStatus = (int)BatchStatus.ScanningInProgress;
        if (!batch.WithSlip.HasValue)
            batch.WithSlip = request.WithSlip;
        batch.ScanType = request.ScanType;
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);
        _logger.LogInformation("Scan started: BatchNo={BatchNo} by UserID={UserId}", batch.BatchNo, userId);
    }

    public async Task StartFeedAsync(long batchId, ScannerFeedRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);
        await _scanner.StartFeedAsync(request.ScannerType, useMock);
        _logger.LogInformation("Feed started: BatchNo={BatchNo} ScannerType={ScannerType}",
            batch.BatchNo, request.ScannerType);
    }

    public async Task StopFeedAsync(long batchId, ScannerFeedRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);
        await _scanner.StopFeedAsync(request.ScannerType, useMock);
        _logger.LogInformation("Feed stopped: BatchNo={BatchNo} ScannerType={ScannerType}",
            batch.BatchNo, request.ScannerType);
    }

    // ─── Slip scan image capture ──────────────────────────────────────────────

    public async Task<SlipScanDto> CaptureSlipScanAsync(long batchId, CaptureSlipScanRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);

        var captured = await _scanner.CaptureSlipAsync(useMock);

        return await SaveSlipScanAsync(new SaveSlipScanRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ImagePath = captured.ImageFrontPath,
            ScannerType = request.ScannerType
        }, userId);
    }

    public async Task<SlipScanDto> UploadMobileSlipScanAsync(long batchId, MobileUploadSlipScanRequest request, int userId)
    {
        var (batch, _) = await GetLockedBatchContextAsync(batchId, userId);

        if (request.Image == null || request.Image.Length == 0)
            throw new ValidationException("Slip scan image is required.");

        var imagePath = await SaveMobileImageAsync(batch.BatchNo, request.Image, $"slip_{request.ScanOrder}");

        return await SaveSlipScanAsync(new SaveSlipScanRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ImagePath = imagePath,
            ScannerType = "Mobile-Camera"
        }, userId);
    }

    private async Task<SlipScanDto> SaveSlipScanAsync(SaveSlipScanRequest request, int userId)
    {
        var scan = new SlipScan
        {
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ImagePath = request.ImagePath,
            ScannerType = request.ScannerType,
            ScanStatus = "Captured",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _slipRepo.CreateSlipScanAsync(scan);
        _logger.LogInformation("Slip scan saved: SlipEntryId={SlipEntryId} Order={Order}",
            request.SlipEntryId, request.ScanOrder);

        return MapSlipScanToDto(scan);
    }

    // ─── Cheque capture ───────────────────────────────────────────────────────

    public async Task<ChequeItemDto> CaptureChequeAsync(long batchId, CaptureChequeRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);

        var captured = await _scanner.CaptureChequeAsync(useMock);

        var seqNo = await _slipRepo.GetNextBatchSeqNoAsync(batchId);
        var chqSeq = await _slipRepo.GetNextChqSeqAsync(request.SlipEntryId);

        return await SaveChequeItemAsync(new SaveChequeItemRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ChqSeq = chqSeq,
            MICRRaw = captured.MICRRaw,
            ChqNo = captured.ChqNo,
            ScanMICR1 = captured.MICR1,
            ScanMICR2 = captured.MICR2,
            ScanMICR3 = captured.MICR3,
            FrontImagePath = captured.ImageFrontPath,
            BackImagePath = captured.ImageBackPath,
            ScannerType = request.ScannerType,
            ScanType = batch.ScanType
        }, userId);
    }

    public async Task<ChequeItemDto> UploadMobileChequeAsync(long batchId, MobileUploadChequeRequest request, int userId)
    {
        var (batch, _) = await GetLockedBatchContextAsync(batchId, userId);

        if (request.ImageFront == null && request.ImageBack == null)
            throw new ValidationException("At least one cheque image is required.");

        var frontPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageFront, "front");
        var backPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageBack, "back");

        return await SaveChequeItemAsync(new SaveChequeItemRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ChqSeq = request.ChqSeq,
            MICRRaw = request.MICRRaw,
            ChqNo = request.ChqNo,
            ScanMICR1 = request.ScanMICR1,
            ScanMICR2 = request.ScanMICR2,
            ScanMICR3 = request.ScanMICR3,
            ScanAmount = request.ScanAmount,
            FrontImagePath = frontPath,
            BackImagePath = backPath,
            ScannerType = "Mobile-Camera",
            ScanType = batch.ScanType
        }, userId);
    }

    public async Task<ChequeItemDto> SaveChequeItemAsync(SaveChequeItemRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(request.BatchId)
            ?? throw new NotFoundException($"Batch {request.BatchId} not found.");

        if (batch.ScanLockedBy != userId)
            throw new ForbiddenException("You do not hold the scan lock for this batch.");

        var seqNo = request.ChqSeq > 0
            ? await _slipRepo.GetNextBatchSeqNoAsync(request.BatchId)
            : await _slipRepo.GetNextBatchSeqNoAsync(request.BatchId);

        var item = new ChequeItem
        {
            SlipEntryId = request.SlipEntryId,
            BatchId = request.BatchId,
            SeqNo = seqNo,
            ChqSeq = request.ChqSeq > 0 ? request.ChqSeq : await _slipRepo.GetNextChqSeqAsync(request.SlipEntryId),
            ChqNo = request.ChqNo?.Trim(),
            MICRRaw = request.MICRRaw,
            ScanMICR1 = request.ScanMICR1?.Trim(),
            ScanMICR2 = request.ScanMICR2?.Trim(),
            ScanMICR3 = request.ScanMICR3?.Trim(),
            ScanAmount = request.ScanAmount,
            FrontImagePath = request.FrontImagePath,
            BackImagePath = request.BackImagePath,
            ScannerType = request.ScannerType,
            ScanType = request.ScanType,
            RRState = (int)RRState.NeedsReview,
            ScanStatus = "Captured",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _slipRepo.CreateChequeItemAsync(item);
        _logger.LogInformation("Cheque saved: BatchId={BatchId} SeqNo={SeqNo} SlipEntryId={SlipEntryId}",
            request.BatchId, seqNo, request.SlipEntryId);

        return MapChequeToDto(item);
    }

    // ─── Complete / Release ───────────────────────────────────────────────────

    public async Task CompleteScanAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (batch.ScanLockedBy != userId)
            throw new ForbiddenException("You do not hold the scan lock for this batch.");

        // Validate that all slip entries have required scans
        var slipGroups = await _slipRepo.GetByBatchAsync(batchId);
        
        if (!slipGroups.Any())
            throw new ValidationException("Cannot complete batch: At least one slip entry is required.");

        var withSlip = batch.WithSlip ?? false;
        var incompleteSlips = new List<string>();

        foreach (var slip in slipGroups)
        {
            var slipScans = slip.SlipScans.Where(s => !s.IsDeleted).ToList();
            var cheques = slip.ChequeItems.Where(c => !c.IsDeleted).ToList();

            // If WithSlip mode, each slip must have at least one slip scan
            if (withSlip && !slipScans.Any())
            {
                incompleteSlips.Add($"Slip {slip.SlipNo}: Missing slip scan image");
            }

            // Each slip must have at least one cheque
            if (!cheques.Any())
            {
                incompleteSlips.Add($"Slip {slip.SlipNo}: No cheques scanned");
            }
        }

        if (incompleteSlips.Any())
        {
            var errorMessage = "Cannot complete batch. Incomplete slips:\n" + 
                             string.Join("\n", incompleteSlips) +
                             "\n\nPlease complete all required scans before finishing the batch.";
            throw new ValidationException(errorMessage);
        }

        var hasRRItems = !await _slipRepo.AllRRResolvedAsync(batchId);

        batch.BatchStatus = hasRRItems
            ? (int)BatchStatus.RRPending
            : (int)BatchStatus.ScanningCompleted;

        batch.ScanLockedBy = null;
        batch.ScanLockedAt = null;
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        var statusLabel = hasRRItems ? "RR Pending" : "Scanning Completed";
        _logger.LogInformation("Scan completed: BatchNo={BatchNo} → {Status}", batch.BatchNo, statusLabel);

        await _audit.LogAsync("Batch", batchId.ToString(), "UPDATE",
            new { BatchStatus = (int)BatchStatus.ScanningInProgress },
            new { BatchStatus = batch.BatchStatus }, userId);
    }

    public async Task ReleaseLockAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (batch.BatchStatus == (int)BatchStatus.ScanningInProgress)
            batch.BatchStatus = (int)BatchStatus.ScanningPending;

        batch.ScanLockedBy = null;
        batch.ScanLockedAt = null;
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;
        await _batchRepo.UpdateAsync(batch);
    }

    public async Task ReopenBatchAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        // Only allow reopening batches that are in ScanningCompleted or RR Pending status
        if (batch.BatchStatus != (int)BatchStatus.ScanningCompleted && 
            batch.BatchStatus != (int)BatchStatus.RRPending)
        {
            throw new ValidationException("Only completed or RR pending batches can be reopened.");
        }

        var oldStatus = batch.BatchStatus;
        batch.BatchStatus = (int)BatchStatus.ScanningPending;
        batch.ScanLockedBy = null;
        batch.ScanLockedAt = null;
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        _logger.LogInformation("Batch reopened: BatchNo={BatchNo} {OldStatus}→ScanningPending by UserID={UserId}", 
            batch.BatchNo, oldStatus, userId);

        await _audit.LogAsync("Batch", batchId.ToString(), "REOPEN",
            new { BatchStatus = oldStatus },
            new { BatchStatus = (int)BatchStatus.ScanningPending }, userId);
    }

    // ─── Resume state builder ─────────────────────────────────────────────────
    // Figures out exactly where the user left off so the frontend can jump back in.
    private static ScanResumeStateDto BuildResumeState(List<SlipEntry> slipGroups, bool withSlip)
    {
        if (!slipGroups.Any())
            return new ScanResumeStateDto { ResumeStep = "SlipEntry" };

        // Find the last slip entry — it's the one most likely to be incomplete
        var last = slipGroups.Last();

        var hasIncompleteEntry = last.SlipStatus == (int)SlipStatus.Open;
        var slipScans = last.SlipScans.Where(s => !s.IsDeleted).ToList();
        var cheques = last.ChequeItems.Where(c => !c.IsDeleted).ToList();

        // If in WithSlip mode and no slip images yet → resume at SlipScan step
        if (withSlip && !slipScans.Any() && hasIncompleteEntry)
        {
            return new ScanResumeStateDto
            {
                ActiveSlipEntryId = last.SlipEntryId,
                ActiveSlipNo = last.SlipNo,
                ResumeStep = "SlipScan",
                NextSlipScanOrder = 1,
                NextChqSeq = 1
            };
        }

        // If no cheques yet → resume at ChequeScan
        if (!cheques.Any())
        {
            return new ScanResumeStateDto
            {
                ActiveSlipEntryId = last.SlipEntryId,
                ActiveSlipNo = last.SlipNo,
                ResumeStep = "ChequeScan",
                NextSlipScanOrder = slipScans.Count + 1,
                NextChqSeq = 1
            };
        }

        // Slip has cheques — either still scanning cheques or ready for next slip
        return new ScanResumeStateDto
        {
            ActiveSlipEntryId = last.SlipEntryId,
            ActiveSlipNo = last.SlipNo,
            ResumeStep = "ChequeScan",
            NextSlipScanOrder = slipScans.Count + 1,
            NextChqSeq = cheques.Max(c => c.ChqSeq) + 1
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async Task<(Batch Batch, bool UseMock)> GetLockedBatchContextAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (batch.ScanLockedBy != userId)
            throw new ForbiddenException("You do not hold the scan lock for this batch.");

        if (batch.BatchStatus != (int)BatchStatus.ScanningInProgress)
            throw new ValidationException("Batch is not in scanning progress state.");

        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException("User not found.");

        return (batch, user.IsDeveloper);
    }

    private async Task<string?> SaveMobileImageAsync(string batchNo, IFormFile? file, string label)
    {
        if (file == null || file.Length <= 0) return null;

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

        var fileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{label}_{Guid.NewGuid():N}{ext}";
        var relativePath = Path.Combine("mobile", DateTime.UtcNow.ToString("yyyyMMdd"), batchNo, fileName)
            .Replace('\\', '/');
        var absolutePath = Path.Combine(
            _imageStorageConfig.BasePath,
            relativePath.Replace('/', Path.DirectorySeparatorChar));

        Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);
        await using var stream = File.Create(absolutePath);
        await file.CopyToAsync(stream);
        return relativePath;
    }

    private static SlipScanDto MapSlipScanToDto(SlipScan s) => new()
    {
        SlipScanId = s.SlipScanId,
        SlipEntryId = s.SlipEntryId,
        ScanOrder = s.ScanOrder,
        ImagePath = s.ImagePath,
        ScanStatus = s.ScanStatus,
        ScanError = s.ScanError,
        RetryCount = s.RetryCount
    };

    private static ChequeItemDto MapChequeToDto(ChequeItem c) => new()
    {
        ChequeItemId = c.ChequeItemId,
        SlipEntryId = c.SlipEntryId,
        BatchId = c.BatchId,
        SeqNo = c.SeqNo,
        ChqSeq = c.ChqSeq,
        ChqNo = c.ChqNo,
        MICRRaw = c.MICRRaw,
        ScanMICR1 = c.ScanMICR1,
        ScanMICR2 = c.ScanMICR2,
        ScanMICR3 = c.ScanMICR3,
        ScanAmount = c.ScanAmount,
        RRMICR1 = c.RRMICR1,
        RRMICR2 = c.RRMICR2,
        RRMICR3 = c.RRMICR3,
        RRAmount = c.RRAmount,
        RRNotes = c.RRNotes,
        RRState = c.RRState,
        FrontImagePath = c.FrontImagePath,
        BackImagePath = c.BackImagePath,
        ScanStatus = c.ScanStatus,
        ScanError = c.ScanError,
        RetryCount = c.RetryCount
    };
}
