// =============================================================================
// File        : IScanRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Repository interface for ScanItems DB operations.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface IScanRepository
{
    Task<ScanItem?> GetByIdAsync(long scanId);
    Task<List<ScanItem>> GetByBatchAsync(long batchId);
    Task<List<ScanItem>> GetRRItemsAsync(long batchId);
    Task<ScanItem> CreateAsync(ScanItem item);
    Task UpdateAsync(ScanItem item);
    Task<int> GetNextSeqNoAsync(long batchId);
    Task<bool> AllCapturedAsync(long batchId);
    Task<bool> AllRRResolvedAsync(long batchId);
}
