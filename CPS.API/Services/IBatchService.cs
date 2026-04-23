// =============================================================================
// File        : IBatchService.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Service interface for batch creation, listing, and status management.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface IBatchService
{
    Task<BatchDto> CreateBatchAsync(CreateBatchRequest request, int userId);
    Task<BatchDto> UpdateBatchAsync(long batchId, UpdateBatchRequest request, int userId);
    Task<PagedResult<BatchDto>> GetBatchListAsync(int? locationId, DateOnly? date, int? status, int page, int pageSize);
    Task<BatchDto> GetBatchAsync(long batchId);
    Task<BatchDto> GetBatchByNumberAsync(string batchNo);
    Task<DashboardSummary> GetDashboardAsync(int locationId, DateOnly date);
    Task UpdateStatusAsync(long batchId, UpdateBatchStatusRequest request, int userId);
}
