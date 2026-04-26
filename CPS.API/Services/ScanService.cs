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
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace CPS.API.Services;

public class ScanService : IScanService
{
    private readonly IBatchRepository _batchRepo;
    private readonly ISlipEntryRepository _slipRepo;
    private readonly IUserRepository _userRepo;
    private readonly IScannerOrchestrator _scanner;
    private readonly IImageStorageConfig _imageStorageConfig;
    private readonly IAuditService _audit;
    private readonly CpsDbContext _db;
    private readonly ILogger<ScanService> _logger;
    private static readonly TimeSpan STALE_LOCK_TIMEOUT = TimeSpan.FromMinutes(30);

    public ScanService(IBatchRepository batchRepo, ISlipEntryRepository slipRepo,
        IUserRepository userRepo, IScannerOrchestrator scanner,
        IImageStorageConfig imageStorageConfig, IAuditService audit, 
        CpsDbContext db, ILogger<ScanService> logger)
    {
        _batchRepo = batchRepo;
        _slipRepo = slipRepo;
        _userRepo = userRepo;
        _scanner = scanner;
        _imageStorageConfig = imageStorageConfig;
        _audit = audit;
        _db = db;
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
            ScanType = batch.ScanType ?? "Scan",
            ScanLockedBy = batch.ScanLockedBy,
            TotalCheques = totalCheques,
            TotalSlipEntries = slipGroups.Count,
            TotalAmount = slipGroups.Sum(s => s.SlipAmount),
            SlipGroups = slipGroups.Select(SlipService.MapToDto).ToList(),
            SlipScans = slipGroups.SelectMany(s => s.SlipScans).Where(ss => !ss.IsDeleted).Select(ss => new SlipScanDto
            {
                SlipScanId = ss.SlipScanId,
                SlipEntryId = ss.SlipEntryId,
                ScanOrder = ss.ScanOrder,
                ScanStatus = ss.ScanStatus,
                ScanError = ss.ScanError,
                RetryCount = ss.RetryCount,
                ImageBaseName = ss.ImageBaseName,
                FileExtension = ss.FileExtension,
                ImageHash = ss.ImageHash
            }).ToList(),
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

        // If 'Without Slip' mode, ensure a global dummy slip exists for all cheques
        if (batch.WithSlip == false && string.IsNullOrEmpty(batch.GlobalSlipNo))
        {
            // Format: {BatchDailySeq:3}{ScannerSuffix:2}GLB
            var batchDailySeq = batch.BatchNo.Length >= 3 ? batch.BatchNo[^3..] : "001";
            string scannerSuffix = "00";
            if (batch.ScannerMappingID.HasValue)
            {
                var scanner = await _db.LocationScanners.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.ScannerMappingID == batch.ScannerMappingID.Value);
                if (scanner != null)
                {
                    var sid = scanner.ScannerID.PadLeft(2, '0');
                    scannerSuffix = sid[^2..];
                }
            }
            batch.GlobalSlipNo = $"{batchDailySeq}{scannerSuffix}GLB";

            // Create the logical slip entry if it doesn't exist
            var exists = await _db.SlipEntries.AnyAsync(s => s.BatchId == batchId && s.SlipNo == batch.GlobalSlipNo);
            if (!exists)
            {
                await _slipRepo.CreateAsync(new SlipEntry
                {
                    BatchId = batchId,
                    SlipNo = batch.GlobalSlipNo,
                    ClientName = "GLOBAL BATCH CONTAINER",
                    PickupPoint = "N/A",
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                    SlipStatus = (int)SlipStatus.Open
                });
            }
        }

        batch.ScanType = request.ScanType;
        if (!batch.ScanStartedAt.HasValue)
        {
            batch.ScanStartedAt = DateTime.UtcNow;
            batch.ScanStartedBy = userId;
        }

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

        var frontFileName = $"{batch.BatchNo}_{request.ScanOrder:D3}SF";
        var captured = await _scanner.CaptureSlipAsync(useMock, frontFileName);

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

        var fileName = $"{batch.BatchNo}_{request.ScanOrder:D3}SF";
        var folder = request.ScannerType == "Mobile-Camera" ? "mobile" : "scanner";
        var imagePath = await SaveMobileImageAsync(batch.BatchNo, request.Image, fileName, folder);

        return await SaveSlipScanAsync(new SaveSlipScanRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ImagePath = imagePath,
            ScannerType = request.ScannerType
        }, userId);
    }

    public async Task<List<SlipScanDto>> UploadBulkSlipScansAsync(long batchId, BulkSlipUploadRequest request, int userId)
    {
        var (batch, _) = await GetLockedBatchContextAsync(batchId, userId);

        if (request.Images == null || request.Images.Count == 0)
            throw new ValidationException("At least one slip image is required.");

        var slipGroups = await _slipRepo.GetByBatchAsync(batchId);
        var results = new List<SlipScanDto>();

        for (int i = 0; i < request.Images.Count; i++)
        {
            var image = request.Images[i];
            
            // Save the physical file once per batch
            var tempFileName = $"{batch.BatchNo}_GLB_{i+1:D2}";
            var imagePath = await SaveMobileImageAsync(batch.BatchNo, image, tempFileName, "upload");

            // Associate this image with EVERY slip in the batch
            foreach (var slip in slipGroups)
            {
                var existingScans = slip.SlipScans.Where(s => !s.IsDeleted).Count();
                var scanOrder = existingScans + 1;

                var saved = await SaveSlipScanAsync(new SaveSlipScanRequest
                {
                    BatchId = batchId,
                    SlipEntryId = slip.SlipEntryId,
                    ScanOrder = scanOrder,
                    ImagePath = imagePath,
                    ScannerType = request.ScannerType
                }, userId);

                // Only return the DTO for the requested slip to avoid UI confusion in the response,
                // but they are all saved.
                if (slip.SlipEntryId == request.SlipEntryId)
                {
                    results.Add(saved);
                }
            }
        }

        return results;
    }



    private async Task<SlipScanDto> SaveSlipScanAsync(SaveSlipScanRequest request, int userId)
    {
        var scan = new SlipScan
        {
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ScannerType = request.ScannerType,
            ScanStatus = "Captured",
            ImageBaseName = GetImageBaseName(request.ImagePath ?? ""),
            FileExtension = Path.GetExtension(request.ImagePath),
            ImageHash = await CalculateFileHashAsync(request.ImagePath),
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _slipRepo.CreateSlipScanAsync(scan);
        _logger.LogInformation("Slip scan saved: SlipEntryId={SlipEntryId} Order={Order}",
            request.SlipEntryId, request.ScanOrder);

        return MapSlipScanToDto(scan);
    }

    private static string GetImageBaseName(string path)
    {
        if (string.IsNullOrEmpty(path)) return path;
        // Strip extensions like .jpg and suffixes like SF, CF, CR
        var baseName = Path.ChangeExtension(path, null);
        if (baseName.EndsWith("SF") || baseName.EndsWith("CF") || baseName.EndsWith("CR"))
            return baseName.Substring(0, baseName.Length - 2);
        if (baseName.EndsWith("GLB"))
            return baseName.Substring(0, baseName.Length - 3);
        return baseName;
    }

    // ─── Cheque capture ───────────────────────────────────────────────────────

    public async Task<ChequeItemDto> CaptureChequeAsync(long batchId, CaptureChequeRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);

        var (seqNo, chqSeq) = await _slipRepo.GetNextAtomicSequencesAsync(batchId, request.SlipEntryId);

        var frontFileName = $"{batch.BatchNo}_{seqNo:D3}CF";
        var backFileName = $"{batch.BatchNo}_{seqNo:D3}CR";

        var captured = await _scanner.CaptureChequeAsync(useMock, frontFileName, backFileName);

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

        var (seqNo, chqSeq) = await _slipRepo.GetNextAtomicSequencesAsync(batchId, request.SlipEntryId);
        var frontFileName = $"{batch.BatchNo}_{seqNo:D3}CF";
        var backFileName = $"{batch.BatchNo}_{seqNo:D3}CR";
        var folder = request.ScannerType == "Mobile-Camera" ? "mobile" : "scanner";

        var frontPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageFront, frontFileName, folder);
        var backPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageBack, backFileName, folder);
        var frontTiffPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageFrontTiff, $"{frontFileName}_T", folder);
        var backTiffPath = await SaveMobileImageAsync(batch.BatchNo, request.ImageBackTiff, $"{backFileName}_T", folder);

        return await SaveChequeItemAsync(new SaveChequeItemRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ChqSeq = chqSeq,
            SeqNo = seqNo,
            MICRRaw = request.MICRRaw,
            ChqNo = request.ChqNo,
            ScanMICR1 = request.ScanMICR1,
            ScanMICR2 = request.ScanMICR2,
            ScanMICR3 = request.ScanMICR3,
            FrontImagePath = frontPath,
            BackImagePath = backPath,
            FrontImageTiffPath = frontTiffPath,
            BackImageTiffPath = backTiffPath,
            ScannerType = request.ScannerType,
            ScanType = batch.ScanType
        }, userId);
    }

    public async Task<ChequeItemDto> SaveChequeItemAsync(SaveChequeItemRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(request.BatchId)
            ?? throw new NotFoundException($"Batch {request.BatchId} not found.");

        if (batch.ScanLockedBy != userId)
            throw new ForbiddenException("You do not hold the scan lock for this batch.");

        int seqNo = request.SeqNo;
        int chqSeq = request.ChqSeq;

        if (seqNo <= 0 || chqSeq <= 0)
        {
            var atomic = await _slipRepo.GetNextAtomicSequencesAsync(request.BatchId, request.SlipEntryId);
            seqNo = atomic.SeqNo;
            chqSeq = atomic.ChqSeq;
        }

        var (parsedChq, pM1, pM2, pM3) = Utils.MICRParser.ParseRanger(request.ScanMICRRaw ?? request.MICRRaw);

        var item = new ChequeItem
        {
            SlipEntryId = request.SlipEntryId,
            BatchId = request.BatchId,
            SeqNo = seqNo,
            ChqSeq = chqSeq,
            
            // Final display fields (defaults to parsed/scanned values)
            ChqNo = parsedChq ?? request.ChqNo?.Trim(),
            MICR1 = pM1 ?? request.ScanMICR1?.Trim(),
            MICR2 = pM2 ?? request.ScanMICR2?.Trim(),
            MICR3 = pM3 ?? request.ScanMICR3?.Trim(),
            MICRRaw = request.MICRRaw,
            
            // Raw scanner capture fields (read-only audit)
            ScanMICRRaw = request.ScanMICRRaw ?? request.MICRRaw,
            ScanChqNo = parsedChq ?? request.ScanChqNo ?? request.ChqNo?.Trim(),
            ScanMICR1 = pM1 ?? request.ScanMICR1?.Trim(),
            ScanMICR2 = pM2 ?? request.ScanMICR2?.Trim(),
            ScanMICR3 = pM3 ?? request.ScanMICR3?.Trim(),
            
            ScannerType = request.ScannerType,
            ScanType = request.ScanType,
            RRState = (int)RRState.NeedsReview,
            ScanStatus = "Captured",
            ImageBaseName = GetImageBaseName(request.FrontImagePath ?? ""),
            FileExtension = Path.GetExtension(request.FrontImagePath),
            ImageHash = await CalculateFileHashAsync(request.FrontImagePath),
            ScannerCompletedBy = userId,
            ScannerCompletedAt = DateTime.UtcNow,
            ScannerStartedAt = DateTime.UtcNow, // Simplified for now
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _slipRepo.CreateChequeItemAsync(item);
        
        // Audit Log (with BatchNo)
        await _audit.LogAsync("ChequeItem", item.ChequeItemId.ToString(), "INSERT", 
            null, new { item.ChqNo, item.ScanChqNo, item.MICR1, item.MICR2, item.MICR3, item.ScanMICRRaw }, 
            userId, batchNo: batch.BatchNo);

        _logger.LogInformation("Cheque saved: BatchId={BatchId} SeqNo={SeqNo} SlipEntryId={SlipEntryId}",
            request.BatchId, seqNo, request.SlipEntryId);

        return MapChequeToDto(item);
    }

    // ─── Complete / Release ───────────────────────────────────────────────────

    public async Task UpdateSlipStatusAsync(long batchId, long slipEntryId, SlipStatus status, int userId)
    {
        var (batch, _) = await GetLockedBatchContextAsync(batchId, userId);

        var slipGroups = await _slipRepo.GetByBatchAsync(batchId);
        var slip = slipGroups.FirstOrDefault(s => s.SlipEntryId == slipEntryId)
            ?? throw new NotFoundException($"Slip {slipEntryId} not found in this batch.");

        slip.SlipStatus = (int)status;
        slip.UpdatedBy = userId;
        slip.UpdatedAt = DateTime.UtcNow;

        if (status == SlipStatus.Complete)
        {
            slip.EntryCompletedAt = DateTime.UtcNow;
        }

        await _slipRepo.UpdateAsync(slip);
    }

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

            // Every slip must have at least one slip scan image (either scanned or manually uploaded)
            if (!slipScans.Any())
            {
                incompleteSlips.Add($"Slip {slip.SlipNo}: Missing slip image (please upload/scan)");
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

        var allCheques = slipGroups.SelectMany(g => g.ChequeItems).Where(c => !c.IsDeleted).ToList();
        var nextGlobalChqSeq = allCheques.Any() ? allCheques.Max(c => c.SeqNo) + 1 : 1;

        var last = slipGroups.Last();
        var slipScans = last.SlipScans.Where(s => !s.IsDeleted).ToList();

        if (last.SlipStatus == (int)SlipStatus.Open)
        {
            return new ScanResumeStateDto
            {
                ActiveSlipEntryId = last.SlipEntryId,
                ActiveSlipNo = last.SlipNo,
                ResumeStep = withSlip ? "SlipScan" : "ChequeScan",
                NextSlipScanOrder = slipScans.Count + 1,
                NextChqSeq = nextGlobalChqSeq
            };
        }
        else if (last.SlipStatus == (int)SlipStatus.SlipScanned)
        {
            return new ScanResumeStateDto
            {
                ActiveSlipEntryId = last.SlipEntryId,
                ActiveSlipNo = last.SlipNo,
                ResumeStep = "ChequeScan",
                NextSlipScanOrder = slipScans.Count + 1,
                NextChqSeq = nextGlobalChqSeq
            };
        }

        // Complated -> ready for next slip
        return new ScanResumeStateDto { ResumeStep = "SlipEntry", NextChqSeq = nextGlobalChqSeq };
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

        var isDev = user.UserRoles.Any(ur => ur.Role != null && ur.Role.RoleName == "Developer");
        return (batch, isDev);
    }

    private async Task<string?> SaveMobileImageAsync(string batchNo, IFormFile? file, string exactFileName, string folderName = "mobile")
    {
        if (file == null || file.Length <= 0) return null;

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

        var fileName = $"{exactFileName}{ext}";
        var relativePath = Path.Combine(folderName, DateTime.UtcNow.ToString("yyyyMMdd"), batchNo, fileName)
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
        ScanStatus = s.ScanStatus,
        ScanError = s.ScanError,
        RetryCount = s.RetryCount,
        ImageBaseName = s.ImageBaseName,
        FileExtension = s.FileExtension,
        ImageHash = s.ImageHash
    };

    private async Task<string?> CalculateFileHashAsync(string? relativePath)
    {
        if (string.IsNullOrEmpty(relativePath)) return null;
        try
        {
            var absolutePath = Path.Combine(_imageStorageConfig.BasePath, relativePath.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(absolutePath)) return null;

            using var sha256 = SHA256.Create();
            await using var stream = File.OpenRead(absolutePath);
            var hashBytes = await sha256.ComputeHashAsync(stream);
            return BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to calculate hash for {Path}", relativePath);
            return null;
        }
    }

    private static ChequeItemDto MapChequeToDto(ChequeItem c) => new()
    {
        ChequeItemId = c.ChequeItemId,
        SlipEntryId = c.SlipEntryId,
        BatchId = c.BatchId,
        SeqNo = c.SeqNo,
        ChqSeq = c.ChqSeq,
        ChqNo = c.ChqNo,
        MICRRaw = c.MICRRaw,
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
        ScanError = c.ScanError,
        RetryCount = c.RetryCount,
        ImageBaseName = c.ImageBaseName,
        FileExtension = c.FileExtension,
        ImageHash = c.ImageHash,
        ScanChqNo = c.ScanChqNo,
        RRChqNo = c.RRChqNo,
        ScanMICRRaw = c.ScanMICRRaw,
        // Added new audit fields to DTO
        ScannerStartedAt = c.ScannerStartedAt,
        ScannerCompletedBy = c.ScannerCompletedBy,
        ScannerCompletedAt = c.ScannerCompletedAt,
        RRStartedAt = c.RRStartedAt,
        RRCompletedBy = c.RRCompletedBy,
        RRCompletedAt = c.RRCompletedAt
    };
}
