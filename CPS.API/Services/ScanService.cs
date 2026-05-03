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
using CPS.API.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
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
    private static readonly TimeSpan STALE_LOCK_TIMEOUT = TimeSpan.FromMinutes(7);

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
            SlipItems = slipGroups.SelectMany(s => s.SlipItems).Where(ss => !ss.IsDeleted).Select(ss => new SlipItemDto
            {
                SlipItemId = ss.SlipItemId,
                SlipEntryId = ss.SlipEntryId,
                ScanOrder = ss.ScanOrder,
                ScanStatus = ss.ScanStatus,
                ScanError = ss.ScanError,
                RetryCount = ss.RetryCount,
                ImageBaseName = ss.ImageBaseName,
                ImageName = ss.ImageName,
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

            // Stale lock: record the previous user's forced release before taking over
            var previousUserId = batch.ScanLockedBy.Value;
            batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "ScanReleased", previousUserId, "Stale lock auto-released");
        }

        batch.ScanLockedBy = userId;
        batch.ScanLockedAt = DateTime.UtcNow;
        batch.BatchStatus = (int)BatchStatus.ScanningInProgress;
        batch.ScanType = request.ScanType;
        if (!batch.WithSlip.HasValue)
            batch.WithSlip = request.WithSlip;

        var isFirstStart = !batch.ScanStartedAt.HasValue;
        if (isFirstStart)
        {
            batch.ScanStartedAt = DateTime.UtcNow;
            batch.ScanStartedBy = userId;
            batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "ScanStarted", userId);
        }
        else
        {
            // A different (or same) user resuming a pending batch
            batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "ScanResumed", userId);
        }

        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);
        _logger.LogInformation("Scan {Action}: BatchNo={BatchNo} by UserID={UserId}",
            isFirstStart ? "started" : "resumed", batch.BatchNo, userId);
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

    public async Task<SlipItemDto> CaptureSlipItemAsync(long batchId, CaptureSlipItemRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);

        var slip = await _db.SlipEntries.AsNoTracking().FirstOrDefaultAsync(s => s.SlipEntryId == request.SlipEntryId);
        var fileName = $"{batch.BatchNo}_{request.ScanOrder:D3}SF";
        var subFolder = "Slip";
        var structuredPath = GetRelativeImagePath(batch.BatchNo, fileName, "Scanner", subFolder);

        var captured = await _scanner.CaptureSlipAsync(useMock, structuredPath);

        return await SaveSlipItemAsync(new SaveSlipItemRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ImagePath = captured.ImageFrontPath,
            ScannerType = request.ScannerType
        }, userId);
    }

    public async Task<SlipItemDto> UploadMobileSlipItemAsync(long batchId, MobileUploadSlipItemRequest request, int userId)
    {
        var (batch, _) = await GetLockedBatchContextAsync(batchId, userId);

        if (request.Image == null || request.Image.Length == 0)
            throw new ValidationException("Slip scan image is required.");

        var slip = await _db.SlipEntries.AsNoTracking().FirstOrDefaultAsync(s => s.SlipEntryId == request.SlipEntryId);
        var fileName = $"{batch.BatchNo}_{request.ScanOrder:D3}SF";
        var rootFolder = GetRootFolder(batch.EntryMode);
        var subFolder = "Slip";

        var imagePath = await SaveMobileImageAsync(batch.BatchNo, request.Image, fileName, rootFolder, subFolder);
        
        // 3. Save Original image if provided
        if (request.ImageOriginal != null)
        {
            await SaveMobileImageAsync(batch.BatchNo, request.ImageOriginal, fileName + "_O", rootFolder, subFolder, request.BBox);
        }

        return await SaveSlipItemAsync(new SaveSlipItemRequest
        {
            BatchId = batchId,
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ImagePath = imagePath,
            ScannerType = GetScannerType(batch.EntryMode, "Document")
        }, userId);
    }

    public async Task<List<SlipItemDto>> UploadBulkSlipItemsAsync(long batchId, BulkSlipItemUploadRequest request, int userId)
    {
        // No lock check — global slip uploads are allowed regardless of who holds the scan/RR lock.
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (request.Images == null || request.Images.Count == 0)
            throw new ValidationException("At least one slip image is required.");

        var results = new List<SlipItemDto>();
        var rootFolder = GetRootFolder(batch.EntryMode);

        // When slipEntryId is 0 (global upload), find or create a dedicated GLOBAL slip entry.
        SlipEntry slip;
        if (request.SlipEntryId == 0)
        {
            var existing = await _db.SlipEntries
                .FirstOrDefaultAsync(s => s.BatchId == batchId && s.SlipNo == "GLOBAL" && !s.IsDeleted);

            if (existing != null)
            {
                slip = existing;
            }
            else
            {
                slip = new SlipEntry
                {
                    BatchId = batchId,
                    SlipNo = "GLOBAL",
                    DepositSlipNo = "GLOBAL",
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                };
                await _slipRepo.CreateAsync(slip);
            }
        }
        else
        {
            slip = await _slipRepo.GetByIdAsync(request.SlipEntryId)
                ?? throw new NotFoundException($"Slip {request.SlipEntryId} not found.");
        }

        for (int i = 0; i < request.Images.Count; i++)
        {
            var image = request.Images[i];

            var existingScans = await _db.SlipItems.CountAsync(s => s.SlipEntryId == slip.SlipEntryId && !s.IsDeleted);
            var scanOrder = existingScans + 1;
            var tempFileName = $"{batch.BatchNo}_GLB_{scanOrder:D2}";
            var imagePath = await SaveMobileImageAsync(batch.BatchNo, image, tempFileName, rootFolder, "GlobalSlip");

            var saved = await SaveSlipItemAsync(new SaveSlipItemRequest
            {
                BatchId = batchId,
                SlipEntryId = slip.SlipEntryId,
                ScanOrder = scanOrder,
                ImagePath = imagePath,
                ScannerType = GetScannerType(batch.EntryMode, "Direct-Upload")
            }, userId);

            results.Add(saved);
        }

        return results;
    }



    private async Task<SlipItemDto> SaveSlipItemAsync(SaveSlipItemRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(request.BatchId);
        var item = new SlipItem
        {
            SlipEntryId = request.SlipEntryId,
            ScanOrder = request.ScanOrder,
            ScannerType = request.ScannerType,
            EntryMode = batch?.EntryMode,
            ScanStatus = "Captured",
            ImageBaseName = string.IsNullOrEmpty(request.ImagePath) ? null : Path.ChangeExtension(request.ImagePath, null),
            ImageName = string.IsNullOrEmpty(request.ImagePath) ? null : Path.GetFileNameWithoutExtension(request.ImagePath),
            FileExtension = Path.GetExtension(request.ImagePath),
            ImageHash = await CalculateFileHashAsync(request.ImagePath),
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _slipRepo.CreateSlipItemAsync(item);
        _logger.LogInformation("Slip scan saved: SlipEntryId={SlipEntryId} Order={Order}",
            request.SlipEntryId, request.ScanOrder);

        return MapSlipItemToDto(item);
    }

    private static string GetChequeBaseName(string? path)
    {
        if (string.IsNullOrEmpty(path)) return string.Empty;
        var baseName = Path.ChangeExtension(path, null);
        // Strip CF or CR suffix (2 chars)
        if (baseName.EndsWith("CF") || baseName.EndsWith("CR"))
            return baseName.Substring(0, baseName.Length - 2);
        return baseName;
    }

    private static string GetChequeExtensions(string? jpgPath, string? tifPath)
    {
        var exts = new List<string>();
        if (!string.IsNullOrEmpty(jpgPath)) exts.Add(".jpg");
        if (!string.IsNullOrEmpty(tifPath)) exts.Add(".tif");
        return string.Join(",", exts);
    }

    private static string GetChequeNameOnly(string? path)
    {
        if (string.IsNullOrEmpty(path)) return string.Empty;
        var fileName = Path.GetFileNameWithoutExtension(path);
        // Strip CF or CR suffix (2 chars)
        if (fileName.EndsWith("CF") || fileName.EndsWith("CR"))
            return fileName.Substring(0, fileName.Length - 2);
        return fileName;
    }

    // ─── Cheque capture ───────────────────────────────────────────────────────

    public async Task<ChequeItemDto> CaptureChequeAsync(long batchId, CaptureChequeRequest request, int userId)
    {
        var (batch, useMock) = await GetLockedBatchContextAsync(batchId, userId);

        var (seqNo, chqSeq) = await _slipRepo.GetNextAtomicSequencesAsync(batchId, request.SlipEntryId);

        var frontName = $"{batch.BatchNo}_{seqNo:D3}CF";
        var backName = $"{batch.BatchNo}_{seqNo:D3}CR";
        var frontPath = GetRelativeImagePath(batch.BatchNo, frontName, "Scanner", "Cheque");
        var backPath = GetRelativeImagePath(batch.BatchNo, backName, "Scanner", "Cheque");

        var captured = await _scanner.CaptureChequeAsync(useMock, frontPath, backPath);

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

        if (request.ImageFront == null)
            throw new ValidationException("Front cheque image is required.");

        var (seqNo, chqSeq) = await _slipRepo.GetNextAtomicSequencesAsync(batchId, request.SlipEntryId);
        var baseFileName = $"{batch.BatchNo}_{seqNo:D3}";
        var rootFolder = GetRootFolder(batch.EntryMode);
        var subFolder = "Cheque";

        // 1. Process and save Front image (multiple formats for CTS)
        var frontResult = await ProcessAndSaveCtsChequeAsync(batch.BatchNo, request.ImageFront, baseFileName + "CF", rootFolder, subFolder);
        
        // 2. Process and save Back image (JPG + TIF)
        string? backPath = null;
        string? backTiffPath = null;
        if (request.ImageBack != null)
        {
            var backResult = await ProcessAndSaveCtsChequeAsync(batch.BatchNo, request.ImageBack, baseFileName + "CR", rootFolder, subFolder);
            backPath = backResult.JpgPath;
            backTiffPath = backResult.TifPath;
        }

        // 3. Save Original images if provided
        if (request.ImageFrontOriginal != null)
        {
            await SaveMobileImageAsync(batch.BatchNo, request.ImageFrontOriginal, baseFileName + "CF_O", rootFolder, subFolder, request.BBoxFront);
        }
        if (request.ImageBackOriginal != null && request.ImageBack != null)
        {
            await SaveMobileImageAsync(batch.BatchNo, request.ImageBackOriginal, baseFileName + "CR_O", rootFolder, subFolder, request.BBoxBack);
        }

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
            FrontImagePath = frontResult.JpgPath,
            BackImagePath = backPath,
            FrontImageTiffPath = frontResult.TifPath,
            BackImageTiffPath = backTiffPath,
            ScannerType = GetScannerType(batch.EntryMode, "Cheque"),
            ScanType = batch.ScanType
        }, userId);
    }

    private async Task<(string JpgPath, string TifPath)> ProcessAndSaveCtsChequeAsync(string batchNo, IFormFile file, string exactFileName, string rootFolder, string subFolder, bool isBack = false)
    {
        using var stream = file.OpenReadStream();
        using var image = await Image.LoadAsync<Rgba32>(stream);

        // ─── Grayscale JPEG (100 DPI) ───
        // Target: 8 inches @ 100 DPI = 800px width
        using var grayImage = image.Clone(x => x
            .Resize(new ResizeOptions { Size = new Size(800, 0), Mode = ResizeMode.Max })
            .Grayscale());
        
        grayImage.Metadata.HorizontalResolution = 100;
        grayImage.Metadata.VerticalResolution = 100;

        var grayRelPath = GetRelativeImagePath(batchNo, exactFileName + ".jpg", rootFolder, subFolder);
        var grayAbsPath = GetAbsolutePath(grayRelPath);
        Directory.CreateDirectory(Path.GetDirectoryName(grayAbsPath)!);
        
        await grayImage.SaveAsJpegAsync(grayAbsPath, new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder { Quality = 80 });

        // ─── B&W TIFF (200 DPI) ───
        // Target: 8 inches @ 200 DPI = 1600px width
        using var bwImage = image.Clone(x => x
            .Resize(new ResizeOptions { Size = new Size(1600, 0), Mode = ResizeMode.Max })
            .BinaryThreshold(0.5f)); 

        bwImage.Metadata.HorizontalResolution = 200;
        bwImage.Metadata.VerticalResolution = 200;

        var tifRelPath = GetRelativeImagePath(batchNo, exactFileName + ".tif", rootFolder, subFolder);
        var tifAbsPath = GetAbsolutePath(tifRelPath);
        Directory.CreateDirectory(Path.GetDirectoryName(tifAbsPath)!);
        
        await bwImage.SaveAsTiffAsync(tifAbsPath);

        return (grayRelPath, tifRelPath);
    }

    private string GetRelativeImagePath(string batchNo, string fileName, string rootFolder, string subFolder)
    {
        var parts = new List<string> { rootFolder, DateTime.UtcNow.ToString("yyyyMMdd"), batchNo };
        if (!string.IsNullOrEmpty(subFolder)) parts.Add(subFolder);
        parts.Add(fileName);
        return Path.Combine(parts.ToArray()).Replace('\\', '/');
    }

    private string GetAbsolutePath(string relativePath)
    {
        return Path.Combine(_imageStorageConfig.BasePath, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }

    private static string GetRootFolder(string? entryMode) =>
        string.Equals(entryMode, "mobile", StringComparison.OrdinalIgnoreCase) ? "Mobile" : "Scanner";

    private static string GetScannerType(string? entryMode, string imageType) =>
        string.Equals(entryMode, "mobile", StringComparison.OrdinalIgnoreCase)
            ? "Mobile-Camera"
            : imageType; // "Document" for slips, "Cheque" for cheques

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
            EntryMode = batch.EntryMode,
            RRState = (int)RRState.NeedsReview,
            ScanStatus = "Captured",
            ImageBaseName = GetChequeBaseName(request.FrontImagePath),
            ImageName = GetChequeNameOnly(request.FrontImagePath),
            FileExtension = GetChequeExtensions(request.FrontImagePath, request.FrontImageTiffPath),
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
            var slipItems = slip.SlipItems.Where(s => !s.IsDeleted).ToList();
            var cheques = slip.ChequeItems.Where(c => !c.IsDeleted).ToList();

            // Every slip must have at least one slip scan image (either scanned or manually uploaded)
            if (!slipItems.Any())
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

        batch.ScanCompletedBy = userId;
        batch.ScanCompletedAt = DateTime.UtcNow;
        batch.ScanLockedBy = null;
        batch.ScanLockedAt = null;
        batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "ScanCompleted", userId);
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
        {
            // If nothing was actually scanned yet, revert fully to Created
            var hasAnyCheques = await _slipRepo.HasAnyChequeItemsAsync(batchId);
            batch.BatchStatus = hasAnyCheques
                ? (int)BatchStatus.ScanningPending
                : (int)BatchStatus.Created;
        }

        batch.ScanLockedBy = null;
        batch.ScanLockedAt = null;
        batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "ScanReleased", userId);
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;
        await _batchRepo.UpdateAsync(batch);
    }

    public async Task HeartbeatAsync(long batchId, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        // Only refresh if this user actually holds the scan lock
        if (batch.ScanLockedBy != userId)
            throw new ForbiddenException("You do not hold the scan lock for this batch.");

        batch.ScanLockedAt = DateTime.UtcNow;
        batch.UpdatedAt    = DateTime.UtcNow;
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
        batch.StatusHistory = BatchHistory.Append(batch.StatusHistory, "Reopened", userId);
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
        var slipItems = last.SlipItems.Where(s => !s.IsDeleted).ToList();

        if (last.SlipStatus == (int)SlipStatus.Open)
        {
            return new ScanResumeStateDto
            {
                ActiveSlipEntryId = last.SlipEntryId,
                ActiveSlipNo = last.SlipNo,
                ResumeStep = withSlip ? "SlipScan" : "ChequeScan",
                NextSlipItemOrder = slipItems.Count + 1,
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
                NextSlipItemOrder = slipItems.Count + 1,
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

    private async Task<string?> SaveMobileImageAsync(string batchNo, IFormFile? file, string exactFileName, string folderName = "Scanner", string subFolder = "", string? bbox = null)
    {
        if (file == null || file.Length <= 0) return null;

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

        var fileName = $"{exactFileName}{ext}";
        var relativePath = GetRelativeImagePath(batchNo, fileName, folderName, subFolder);
        var absolutePath = GetAbsolutePath(relativePath);

        Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);

        if (!string.IsNullOrEmpty(bbox))
        {
            try
            {
                // Inject BBox into EXIF metadata
                using var image = await Image.LoadAsync(file.OpenReadStream());
                image.Metadata.ExifProfile ??= new SixLabors.ImageSharp.Metadata.Profiles.Exif.ExifProfile();
                image.Metadata.ExifProfile.SetValue(SixLabors.ImageSharp.Metadata.Profiles.Exif.ExifTag.UserComment, bbox);
                await image.SaveAsync(absolutePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write BBox metadata to original image. Saving raw instead.");
                await using var stream = File.Create(absolutePath);
                await file.CopyToAsync(stream);
            }
        }
        else
        {
            await using var stream = File.Create(absolutePath);
            await file.CopyToAsync(stream);
        }
        
        return relativePath;
    }

    private static SlipItemDto MapSlipItemToDto(SlipItem s) => new()
    {
        SlipItemId = s.SlipItemId,
        SlipEntryId = s.SlipEntryId,
        ScanOrder = s.ScanOrder,
        ScanStatus = s.ScanStatus,
        ScanError = s.ScanError,
        RetryCount = s.RetryCount,
        ImageBaseName = s.ImageBaseName,
        ImageName = s.ImageName,
        FileExtension = s.FileExtension,
        ImageHash = s.ImageHash,
        EntryMode = s.EntryMode
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
        ImageName = c.ImageName,
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
        RRCompletedAt = c.RRCompletedAt,
        EntryMode = c.EntryMode
    };
}
