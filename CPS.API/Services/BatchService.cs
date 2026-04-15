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
    private readonly IAuditService _audit;
    private readonly ILogger<BatchService> _logger;

    public BatchService(IBatchRepository batchRepo, ILocationRepository locationRepo,
        IAuditService audit, ILogger<BatchService> logger)
    {
        _batchRepo = batchRepo;
        _locationRepo = locationRepo;
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

        // PIF and Summary Ref No are always system-generated using the same pattern.
        // Pattern: {PIFPrefix-or-LocationCode}{ddMMyyyy}{seq:D2}

        // BatchNo format requested:
        // {ScannerID}{ddMMyyyy}{seq:D5}
        // Example: SCN011404202600001
        var scanner = request.ScannerMappingID > 0
            ? location.Scanners.FirstOrDefault(s => s.ScannerMappingID == request.ScannerMappingID && s.IsActive)
            : location.Scanners.FirstOrDefault(s => s.IsActive);

        if (scanner == null || string.IsNullOrWhiteSpace(scanner.ScannerID))
            throw new ValidationException("Active ScannerID not found for selected location.");

        var seqNo = await _batchRepo.GetNextSequenceAsync(request.BatchDate, request.LocationID);
        var datePart = request.BatchDate.ToString("ddMMyyyy");
        var batchNo = $"{scanner.ScannerID.Trim()}{datePart}{seqNo:D5}";
        var pifPrefix = (location.PIFPrefix ?? location.LocationCode).Trim();
        var generatedRefNo = $"{pifPrefix}{datePart}{seqNo:D2}";
        var summRefNo = generatedRefNo;
        var pif = generatedRefNo;

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
            BatchStatus = (int)BatchStatus.Created,
            StatusHistory = $"[{{\"status\":0,\"label\":\"Created\",\"at\":\"{DateTime.UtcNow:O}\",\"by\":{userId}}}]",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _batchRepo.CreateAsync(batch);

        _logger.LogInformation("Batch created: {BatchNo} by UserID={UserId}", batchNo, userId);
        await _audit.LogAsync("Batch", batch.BatchID.ToString(), "INSERT", null, new { batchNo, userId }, userId);

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

        await _batchRepo.UpdateAsync(batch);

        _logger.LogInformation("Batch {BatchNo} status: {Old}→{New} by UserID={UserId}",
            batch.BatchNo, oldStatus, request.NewStatus, userId);

        await _audit.LogAsync("Batch", batchId.ToString(), "UPDATE",
            new { BatchStatus = oldStatus },
            new { BatchStatus = request.NewStatus, Reason = request.Reason },
            userId);
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
            WithSlip = b.WithSlip,
            BatchStatus = b.BatchStatus,
            BatchStatusLabel = statusLabels.TryGetValue(b.BatchStatus, out var lbl) ? lbl : "Unknown",
            CreatedAt = b.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
        });
    }
}
