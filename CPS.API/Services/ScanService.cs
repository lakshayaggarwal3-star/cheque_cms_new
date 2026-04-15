// =============================================================================
// File        : ScanService.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Manages scan session locks, cheque saving, MICR evaluation, and scan completion.
// Created     : 2026-04-14
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
    private readonly IScanRepository _scanRepo;
    private readonly IUserRepository _userRepo;
    private readonly IScannerOrchestrator _scanner;
    private readonly IImageStorageConfig _imageStorageConfig;
    private readonly IAuditService _audit;
    private readonly ILogger<ScanService> _logger;
    private static readonly TimeSpan STALE_LOCK_TIMEOUT = TimeSpan.FromMinutes(30);

    public ScanService(IBatchRepository batchRepo, IScanRepository scanRepo, IUserRepository userRepo,
        IScannerOrchestrator scanner, IImageStorageConfig imageStorageConfig, IAuditService audit, ILogger<ScanService> logger)
    {
        _batchRepo = batchRepo;
        _scanRepo = scanRepo;
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

        var items = await _scanRepo.GetByBatchAsync(batchId);

        return new ScanSessionDto
        {
            BatchID = batch.BatchID,
            BatchNo = batch.BatchNo,
            BatchStatus = batch.BatchStatus,
            WithSlip = batch.WithSlip,
            ScanType = batch.ScanType,
            ScanLockedBy = batch.ScanLockedBy,
            TotalScanned = items.Count(i => !i.IsSlip),
            TotalSlips = items.Count(i => i.IsSlip),
            Items = items.Select(MapToDto).ToList()
        };
    }

    public async Task StartScanAsync(long batchId, StartScanRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (!string.Equals(request.ScanType, "Scan", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.ScanType, "Rescan", StringComparison.OrdinalIgnoreCase))
            throw new ValidationException("ScanType must be either 'Scan' or 'Rescan'.");

        // Check lock
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
        {
            batch.WithSlip = request.WithSlip;
        }
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
        _logger.LogInformation("Feed started: BatchNo={BatchNo} ScannerType={ScannerType} Mode={Mode}",
            batch.BatchNo, request.ScannerType, useMock ? "Mock" : "Real");
    }

    public async Task StopFeedAsync(long batchId, ScannerFeedRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);
        await _scanner.StopFeedAsync(request.ScannerType, useMock);
        _logger.LogInformation("Feed stopped: BatchNo={BatchNo} ScannerType={ScannerType} Mode={Mode}",
            batch.BatchNo, request.ScannerType, useMock ? "Mock" : "Real");
    }

    public async Task<ScanItemDto> CaptureAsync(long batchId, CaptureScanRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);

        ScannerCaptureResult captured;
        if (request.IsSlip)
            captured = await _scanner.CaptureSlipAsync(useMock);
        else
            captured = await _scanner.CaptureChequeAsync(useMock);

        var saveRequest = new SaveChequeRequest
        {
            BatchID = batchId,
            IsSlip = request.IsSlip,
            SlipID = request.SlipID,
            ImageFrontPath = captured.ImageFrontPath,
            ImageBackPath = captured.ImageBackPath,
            MICRRaw = captured.MICRRaw,
            ChqNo = captured.ChqNo,
            MICR1 = captured.MICR1,
            MICR2 = captured.MICR2,
            MICR3 = captured.MICR3,
            ScannerType = request.ScannerType,
            ScanType = batch.ScanType
        };

        return await SaveChequeAsync(saveRequest, userId);
    }

    public async Task<ScanItemDto> SaveChequeAsync(SaveChequeRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(request.BatchID)
            ?? throw new NotFoundException($"Batch {request.BatchID} not found.");

        if (batch.ScanLockedBy != userId)
            throw new ForbiddenException("You do not hold the scan lock for this batch.");

        var seqNo = request.SeqNo > 0
            ? request.SeqNo
            : await _scanRepo.GetNextSeqNoAsync(request.BatchID);

        // Temporary rule: force all cheque items into RR review.
        // We'll introduce smarter auto-approval logic later.
        var rrState = request.IsSlip
            ? (int)RRState.Approved
            : (int)RRState.NeedsReview;

        var item = new ScanItem
        {
            BatchID = request.BatchID,
            SeqNo = seqNo,
            IsSlip = request.IsSlip,
            SlipID = request.SlipID,
            ImageFrontPath = request.ImageFrontPath,
            ImageBackPath = request.ImageBackPath,
            MICRRaw = request.MICRRaw,
            ChqNo = request.ChqNo?.Trim(),
            MICR1 = request.MICR1?.Trim(),
            MICR2 = request.MICR2?.Trim(),
            MICR3 = request.MICR3?.Trim(),
            ScannerType = request.ScannerType,
            ScanType = request.ScanType,
            RRState = rrState,
            ScanStatus = "Captured",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _scanRepo.CreateAsync(item);
        _logger.LogInformation("Cheque saved: BatchID={BatchID} SeqNo={SeqNo} Path={Path}",
            request.BatchID, seqNo, request.ImageFrontPath);

        return MapToDto(item);
    }

    public async Task<ScanItemDto> UploadMobileCaptureAsync(long batchId, MobileUploadScanRequest request, int userId)
    {
        var (batch, _) = await GetLockedBatchContextAsync(batchId, userId);

        if (request.ImageFront == null && request.ImageBack == null)
            throw new ValidationException("At least one image is required.");

        var frontPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageFront, "front");
        var backPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageBack, "back");

        var saveRequest = new SaveChequeRequest
        {
            BatchID = batchId,
            IsSlip = request.IsSlip,
            SlipID = request.SlipID,
            ImageFrontPath = frontPath,
            ImageBackPath = backPath,
            MICRRaw = request.MICRRaw,
            ChqNo = request.ChqNo,
            MICR1 = request.MICR1,
            MICR2 = request.MICR2,
            MICR3 = request.MICR3,
            ScannerType = string.IsNullOrWhiteSpace(request.ScannerType) ? "Mobile-Camera" : request.ScannerType,
            ScanType = batch.ScanType
        };

        return await SaveChequeAsync(saveRequest, userId);
    }

    public async Task CompleteScanAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (batch.ScanLockedBy != userId)
            throw new ForbiddenException("You do not hold the scan lock for this batch.");

        // Evaluate MICR errors
        var hasRRItems = !await _scanRepo.AllRRResolvedAsync(batchId) ||
            await HasMICRErrorsAsync(batchId);

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
            new { BatchStatus = batch.BatchStatus },
            userId);
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

    private async Task<bool> HasMICRErrorsAsync(long batchId)
    {
        var items = await _scanRepo.GetByBatchAsync(batchId);
        return items.Any(i => !i.IsSlip && i.RRState == (int)RRState.NeedsReview);
    }

    private static ScanItemDto MapToDto(ScanItem i) => new()
    {
        ScanID = i.ScanID,
        BatchID = i.BatchID,
        SeqNo = i.SeqNo,
        IsSlip = i.IsSlip,
        SlipID = i.SlipID,
        ImageFrontPath = i.ImageFrontPath,
        ImageBackPath = i.ImageBackPath,
        MICRRaw = i.MICRRaw,
        ChqNo = i.ChqNo,
        MICR1 = i.MICR1,
        MICR2 = i.MICR2,
        MICR3 = i.MICR3,
        ScannerType = i.ScannerType ?? string.Empty,
        ScanStatus = i.ScanStatus,
        ScanError = i.ScanError,
        RetryCount = i.RetryCount,
        RRState = i.RRState
    };

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

    private async Task<string?> SaveMobileImageAsync(string batchNo, IFormFile? file, string side)
    {
        if (file == null || file.Length <= 0) return null;

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension)) extension = ".jpg";
        var fileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{side}_{Guid.NewGuid():N}{extension}";
        var relativePath = Path.Combine("mobile", DateTime.UtcNow.ToString("yyyyMMdd"), batchNo, fileName)
            .Replace('\\', '/');
        var absolutePath = Path.Combine(_imageStorageConfig.BasePath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var directory = Path.GetDirectoryName(absolutePath)!;
        Directory.CreateDirectory(directory);

        await using var stream = File.Create(absolutePath);
        await file.CopyToAsync(stream);
        return relativePath;
    }
}
