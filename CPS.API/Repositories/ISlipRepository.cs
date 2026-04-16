// =============================================================================
// File        : ISlipRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Repository interface for slip DB operations.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface ISlipRepository
{
    Task<Slip?> GetByIdAsync(int slipId);
    Task<List<Slip>> GetByBatchAsync(long batchId);
    Task<bool> SlipNoExistsAsync(long batchId, string slipNo, int? excludeSlipId = null);
    Task<Slip> CreateAsync(Slip slip);
    Task UpdateAsync(Slip slip);
    /// <summary>Generate next Slip No: {ScannerID}{2-digit-seq} (e.g., 38501, 38502)</summary>
    Task<string> GenerateNextSlipNoAsync(int locationId, int? scannerMappingId);
}
