// =============================================================================
// File        : BatchService.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Business logic for batch creation, status transitions, and sequence number generation.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;

namespace CPS.API.Services;

public class BatchService : IBatchService
{
    private readonly IBatchRepository _batchRepo;
    private readonly ILocationRepository _locationRepo;
    private readonly IUserRepository _userRepo;
    private readonly IUserSettingRepository _userSettingRepo;
    private readonly IAuditService _audit;
    private readonly ILogger<BatchService> _logger;

    public BatchService(IBatchRepository batchRepo, ILocationRepository locationRepo,
        IUserRepository userRepo, IUserSettingRepository userSettingRepo,
        IAuditService audit, ILogger<BatchService> logger)
    {
        _batchRepo = batchRepo;
        _locationRepo = locationRepo;
        _userRepo = userRepo;
        _userSettingRepo = userSettingRepo;
        _audit = audit;
        _logger = logger;
    }

    public async Task<BatchDto> CreateBatchAsync(CreateBatchRequest request, int userId)
    {
        var location = await _locationRepo.GetByIdAsync(request.LocationID)
            ?? throw new NotFoundException($"Location {request.LocationID} not found.");

        if (!location.IsActive)
            throw new ValidationException("Selected location is not active.");

        if (request.IsPDC && request.PDCDate == null)
            throw new ValidationException("PDC date is required when PDC is enabled.");

        if (request.IsPDC && request.PDCDate <= request.BatchDate)
            throw new ValidationException("PDC date must be after batch date.");

        var entryMode = await DeriveEntryModeAsync(userId);
        var isMobileMode = entryMode == "mobile";

        // BatchNo format requested:
        // {ScannerID}{yyyyMMdd}{seq:D5}
        // Example: SCN012026041400001
        var scanner = request.ScannerMappingID > 0
            ? location.Scanners.FirstOrDefault(s => s.ScannerMappingID == request.ScannerMappingID && s.IsActive)
            : location.Scanners.FirstOrDefault(s => s.IsActive);

        if (scanner == null || string.IsNullOrWhiteSpace(scanner.ScannerID))
            throw new ValidationException("Active ScannerID not found for selected location.");

        var scannerMappingId = request.ScannerMappingID > 0 ? request.ScannerMappingID : (int?)scanner.ScannerMappingID;
        var seqNo = await _batchRepo.GetNextSequenceAsync(request.BatchDate, request.LocationID, scannerMappingId);
        
        var rawScannerId = scanner.ScannerID.Trim();
        var scannerPart = rawScannerId.Length == 3 ? (rawScannerId + rawScannerId) : rawScannerId;
        var datePart = request.BatchDate.ToString("yyMMdd");
        var batchNo = $"{scannerPart}{datePart}{seqNo:D4}";
        
        string? summRefNo = null;
        string? pif = null;

        if (!isMobileMode)
        {
            // Scanner Mode: Auto-generate SummRefNo and PIF during batch creation
            // Pattern: {PIFPrefix-or-LocationCode}{yyyyMMdd}{seq:D2}
            var pifPrefix = (location.PIFPrefix ?? location.LocationCode).Trim();
            var generatedRefNo = $"{pifPrefix}{datePart}{seqNo:D2}";
            summRefNo = generatedRefNo;
            pif = generatedRefNo;
        }
        // Mobile Mode: SummRefNo and PIF will be provided later via UpdateBatchAsync

        var batch = new Batch
        {
            BatchNo   = batchNo,
            SummRefNo = summRefNo,
            PIF       = pif,
            LocationID = request.LocationID,
            ScannerMappingID = request.ScannerMappingID > 0 ? request.ScannerMappingID : null,
            PickupPointCode = request.PickupPointCode?.Trim(),
            BatchDate = request.BatchDate,
            ClearingType = request.ClearingType,
            IsPDC = request.IsPDC,
            PDCDate = request.PDCDate,
            TotalSlips = request.TotalSlips,
            TotalAmount = request.TotalAmount,
            EntryMode = entryMode,
            BatchStatus = (int)BatchStatus.Created,
            StatusHistory = $"[{{\"status\":0,\"label\":\"Created\",\"at\":\"{DateTime.UtcNow:O}\",\"by\":{userId}}}]",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _batchRepo.CreateAsync(batch);

        _logger.LogInformation("Batch created: {BatchNo} by UserID={UserId}", batchNo, userId);
        await _audit.LogAsync("Batch", batch.BatchID.ToString(), "INSERT", null, 
            new { batchNo, userId, locationId = request.LocationID, entryMode, totalSlips = request.TotalSlips, totalAmount = request.TotalAmount }, 
            userId, batchNo: batchNo);

        return await MapToBatchDto(batch);
    }

    public async Task<BatchDto> UpdateBatchAsync(long batchId, UpdateBatchRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        if (request.IsPDC && request.PDCDate == null)
            throw new ValidationException("PDC date is required when PDC is enabled.");

        if (request.IsPDC && request.PDCDate <= batch.BatchDate)
            throw new ValidationException("PDC date must be after batch date.");

        // Total Slips and Amount validation:
        // - If provided (> 0), accept it
        // - If 0 or not provided, it's optional (scanner mode may fill later)
        // - Only reject if negative
        if (request.TotalSlips < 0)
            throw new ValidationException("Total slips cannot be negative.");

        if (request.TotalAmount < 0)
            throw new ValidationException("Total amount cannot be negative.");

        // Validate SummRefNo and PIF are provided (required for all batches before scanning)
        if (string.IsNullOrWhiteSpace(request.SummRefNo))
            throw new ValidationException("Summary Ref No is required before starting scanning.");
        if (string.IsNullOrWhiteSpace(request.PIF))
            throw new ValidationException("PIF No is required before starting scanning.");

        var old = new { batch.TotalSlips, batch.TotalAmount, batch.SummRefNo, batch.PIF, batch.IsPDC, batch.PDCDate, batch.ScanType, batch.WithSlip };

        batch.TotalSlips = request.TotalSlips;
        batch.TotalAmount = request.TotalAmount;
        batch.SummRefNo = request.SummRefNo?.Trim();
        batch.PIF = request.PIF?.Trim();
        batch.IsPDC = request.IsPDC;
        batch.PDCDate = request.PDCDate;
        
        // Update scan type and slip mode if provided
        if (!string.IsNullOrWhiteSpace(request.ScanType))
        {
            if (!string.Equals(request.ScanType, "Scan", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(request.ScanType, "Rescan", StringComparison.OrdinalIgnoreCase))
                throw new ValidationException("ScanType must be either 'Scan' or 'Rescan'.");
            batch.ScanType = request.ScanType;
        }
        
        if (request.WithSlip.HasValue)
        {
            batch.WithSlip = request.WithSlip;
            await _userSettingRepo.UpsertAsync(userId, "WithSlip", request.WithSlip.Value ? "true" : "false");
        }
        
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        _logger.LogInformation("Batch updated: BatchID={BatchId} by UserID={UserId}", batchId, userId);
        await _audit.LogAsync("Batch", batchId.ToString(), "UPDATE", old,
            new { request.TotalSlips, request.TotalAmount, request.SummRefNo, request.PIF, request.ScanType, request.WithSlip }, 
            userId, batchNo: batch.BatchNo);

        return await MapToBatchDto(batch);
    }

    public async Task<PagedResult<BatchDto>> GetBatchListAsync(
        int? locationId, DateOnly? date, int? status, int page, int pageSize)
    {
        pageSize = Math.Min(pageSize, 100);
        var items = await _batchRepo.GetListAsync(locationId, date, status, page, pageSize);
        var total = await _batchRepo.GetTotalCountAsync(locationId, date, status);

        var dtos = new List<BatchDto>();
        foreach (var b in items)
            dtos.Add(await MapToBatchDto(b));

        return new PagedResult<BatchDto>
        {
            Items = dtos,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<BatchDto> GetBatchAsync(long batchId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");
        return await MapToBatchDto(batch);
    }

    public async Task<BatchDto> GetBatchByNumberAsync(string batchNo)
    {
        var batch = await _batchRepo.GetByNoAsync(batchNo)
            ?? throw new NotFoundException($"Batch {batchNo} not found.");
        return await MapToBatchDto(batch);
    }

    public async Task<DashboardSummary> GetDashboardAsync(int locationId, DateOnly date)
    {
        var counts = await _batchRepo.GetDashboardCountsAsync(locationId, date);
        return new DashboardSummary
        {
            TotalBatchesToday = counts.Total,
            ScanningPending = counts.ScanningPending,
            RRPending = counts.RRPending,
            Completed = counts.Completed
        };
    }

    public async Task UpdateStatusAsync(long batchId, UpdateBatchStatusRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        var oldStatus = batch.BatchStatus;
        batch.BatchStatus = request.NewStatus;
        batch.UpdatedBy = userId;
        batch.UpdatedAt = DateTime.UtcNow;

        if (request.NewStatus == 3) // Scanning Completed
        {
            batch.ScanCompletedBy = userId;
            batch.ScanCompletedAt = DateTime.UtcNow;
            batch.ScanLockedBy = null;
            batch.ScanLockedAt = null;
        }
        else if (request.NewStatus == 5) // RR Completed
        {
            batch.RRCompletedBy = userId;
            batch.RRCompletedAt = DateTime.UtcNow;
            batch.RRLockedBy = null;
            batch.RRLockedAt = null;
        }

        await _batchRepo.UpdateAsync(batch);

        _logger.LogInformation("Batch {BatchNo} status: {Old}→{New} by UserID={UserId}",
            batch.BatchNo, oldStatus, request.NewStatus, userId);

        await _audit.LogAsync("Batch", batchId.ToString(), "UPDATE",
            new { BatchStatus = oldStatus },
            new { BatchStatus = request.NewStatus, Reason = request.Reason },
            userId, batchNo: batch.BatchNo);
    }

    // Derives entry mode from user roles — never trust client-supplied value.
    // Developers read their own "ScanMode" UserSetting (default: "scanner" if not set).
    // All other roles are determined directly from the role flag.
    private async Task<string> DeriveEntryModeAsync(int userId)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");

        var roles = user.UserRoles
            .Where(ur => ur.Role != null)
            .Select(ur => ur.Role!.RoleName)
            .ToList();

        if (roles.Contains("Developer"))
        {
            var setting = await _userSettingRepo.GetAsync(userId, "ScanMode");
            return setting ?? "scanner";
        }

        if (roles.Contains("Mobile Scanner")) return "mobile";
        if (roles.Contains("Scanner")) return "scanner";

        throw new ForbiddenException("User does not have a scanner or mobile scanner role.");
    }

    private Task<BatchDto> MapToBatchDto(Batch b)
    {
        var statusLabels = new Dictionary<int, string>
        {
            { 0, "Created — Scanning Not Started" },
            { 1, "Scanning In Progress" },
            { 2, "Scanning Pending" },
            { 3, "Scanning Completed" },
            { 4, "RR Pending" },
            { 5, "RR Completed" }
        };

        return Task.FromResult(new BatchDto
        {
            BatchID   = b.BatchID,
            BatchNo   = b.BatchNo,
            SummRefNo = b.SummRefNo,
            PIF       = b.PIF,
            LocationID = b.LocationID,
            LocationName = b.Location?.LocationName ?? string.Empty,
            LocationCode = b.Location?.LocationCode ?? string.Empty,
            ClusterCode = b.Location?.ClusterCode ?? string.Empty,
            ScannerMappingID = b.ScannerMappingID,
            ScannerID = b.Scanner?.ScannerID,
            PickupPointCode = b.PickupPointCode,
            BatchDate = b.BatchDate.ToString("yyyy-MM-dd"),
            ClearingType = b.ClearingType,
            IsPDC = b.IsPDC,
            PDCDate = b.PDCDate?.ToString("yyyy-MM-dd"),
            TotalSlips = b.TotalSlips,
            TotalAmount = b.TotalAmount,
            ScanType = b.ScanType,
            EntryMode = b.EntryMode,
            WithSlip = b.WithSlip,
            BatchStatus = b.BatchStatus,
            BatchStatusLabel = statusLabels.TryGetValue(b.BatchStatus, out var lbl) ? lbl : "Unknown",
            CreatedAt = b.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
        });
    }
}
