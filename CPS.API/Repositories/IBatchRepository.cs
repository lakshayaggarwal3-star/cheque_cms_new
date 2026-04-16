// =============================================================================
// File        : IBatchRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Repository interface for batch and batch-sequence DB operations.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface IBatchRepository
{
    Task<Batch?> GetByIdAsync(long batchId);
    Task<Batch?> GetByNoAsync(string batchNo);
    Task<List<Batch>> GetListAsync(int? locationId, DateOnly? date, int? status, int page, int pageSize);
    Task<int> GetTotalCountAsync(int? locationId, DateOnly? date, int? status);
    Task<Batch> CreateAsync(Batch batch);
    Task UpdateAsync(Batch batch);
    Task<int> GetNextSequenceAsync(DateOnly date, int locationId, int? scannerMappingId = null);
    Task<DashboardCounts> GetDashboardCountsAsync(int locationId, DateOnly date);
}

public class DashboardCounts
{
    public int Total { get; set; }
    public int ScanningPending { get; set; }
    public int RRPending { get; set; }
    public int Completed { get; set; }
}
