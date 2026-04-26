// =============================================================================
// File        : ISlipEntryRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Repository interface for SlipEntry, SlipScan, and ChequeItem DB operations.
// Created     : 2026-04-17
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface ISlipEntryRepository
{
    Task<SlipEntry?> GetByIdAsync(long slipEntryId);
    Task<List<SlipEntry>> GetByBatchAsync(long batchId);
    Task<bool> SlipNoExistsAsync(long batchId, string slipNo, long? excludeId = null);
    Task<SlipEntry> CreateAsync(SlipEntry entry);
    Task UpdateAsync(SlipEntry entry);

    // SlipItem
    Task<SlipItem?> GetSlipItemByIdAsync(long slipItemId);
    Task<List<SlipItem>> GetSlipItemsByEntryAsync(long slipEntryId);
    Task<SlipItem> CreateSlipItemAsync(SlipItem item);
    Task UpdateSlipItemAsync(SlipItem item);

    // ChequeItem
    Task<ChequeItem?> GetChequeItemByIdAsync(long chequeItemId);
    Task<List<ChequeItem>> GetChequeItemsByBatchAsync(long batchId);
    Task<List<ChequeItem>> GetChequeItemsBySlipAsync(long slipEntryId);
    Task<ChequeItem> CreateChequeItemAsync(ChequeItem item);
    Task UpdateChequeItemAsync(ChequeItem item);
    Task<(int SeqNo, int ChqSeq)> GetNextAtomicSequencesAsync(long batchId, long slipEntryId);
    Task<bool> AllRRResolvedAsync(long batchId);

    // SlipNo generation — locked transaction
    Task<string> GenerateNextSlipNoAsync(long batchId, int locationId, int? scannerMappingId);
}
