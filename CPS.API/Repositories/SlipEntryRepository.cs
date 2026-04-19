// =============================================================================
// File        : SlipEntryRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : EF Core implementation of ISlipEntryRepository.
// Created     : 2026-04-17
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class SlipEntryRepository : ISlipEntryRepository
{
    private readonly CpsDbContext _db;

    public SlipEntryRepository(CpsDbContext db) => _db = db;

    // ─── SlipEntry ────────────────────────────────────────────────────────────

    public async Task<SlipEntry?> GetByIdAsync(int slipEntryId) =>
        await _db.SlipEntries
            .Include(s => s.SlipScans.Where(ss => !ss.IsDeleted).OrderBy(ss => ss.ScanOrder))
            .Include(s => s.ChequeItems.Where(c => !c.IsDeleted).OrderBy(c => c.ChqSeq))
            .AsSplitQuery()
            .FirstOrDefaultAsync(s => s.SlipEntryId == slipEntryId && !s.IsDeleted);

    public async Task<List<SlipEntry>> GetByBatchAsync(long batchId) =>
        await _db.SlipEntries
            .Include(s => s.SlipScans.Where(ss => !ss.IsDeleted).OrderBy(ss => ss.ScanOrder))
            .Include(s => s.ChequeItems.Where(c => !c.IsDeleted).OrderBy(c => c.ChqSeq))
            .AsSplitQuery()
            .Where(s => s.BatchId == batchId && !s.IsDeleted)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync();

    public async Task<bool> SlipNoExistsAsync(long batchId, string slipNo, int? excludeId = null) =>
        await _db.SlipEntries.AnyAsync(s =>
            s.BatchId == batchId &&
            s.SlipNo == slipNo &&
            !s.IsDeleted &&
            (excludeId == null || s.SlipEntryId != excludeId));

    public async Task<SlipEntry> CreateAsync(SlipEntry entry)
    {
        _db.SlipEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry;
    }

    public async Task UpdateAsync(SlipEntry entry)
    {
        _db.SlipEntries.Update(entry);
        await _db.SaveChangesAsync();
    }

    // ─── SlipScan ─────────────────────────────────────────────────────────────

    public async Task<SlipScan?> GetSlipScanByIdAsync(long slipScanId) =>
        await _db.SlipScans.FirstOrDefaultAsync(s => s.SlipScanId == slipScanId && !s.IsDeleted);

    public async Task<List<SlipScan>> GetSlipScansByEntryAsync(int slipEntryId) =>
        await _db.SlipScans
            .Where(s => s.SlipEntryId == slipEntryId && !s.IsDeleted)
            .OrderBy(s => s.ScanOrder)
            .ToListAsync();

    public async Task<SlipScan> CreateSlipScanAsync(SlipScan scan)
    {
        _db.SlipScans.Add(scan);
        await _db.SaveChangesAsync();
        return scan;
    }

    public async Task UpdateSlipScanAsync(SlipScan scan)
    {
        _db.SlipScans.Update(scan);
        await _db.SaveChangesAsync();
    }

    // ─── ChequeItem ───────────────────────────────────────────────────────────

    public async Task<ChequeItem?> GetChequeItemByIdAsync(long chequeItemId) =>
        await _db.ChequeItems.FirstOrDefaultAsync(c => c.ChequeItemId == chequeItemId && !c.IsDeleted);

    public async Task<List<ChequeItem>> GetChequeItemsByBatchAsync(long batchId) =>
        await _db.ChequeItems
            .Where(c => c.BatchId == batchId && !c.IsDeleted)
            .OrderBy(c => c.SeqNo)
            .ToListAsync();

    public async Task<List<ChequeItem>> GetChequeItemsBySlipAsync(int slipEntryId) =>
        await _db.ChequeItems
            .Where(c => c.SlipEntryId == slipEntryId && !c.IsDeleted)
            .OrderBy(c => c.ChqSeq)
            .ToListAsync();

    public async Task<ChequeItem> CreateChequeItemAsync(ChequeItem item)
    {
        _db.ChequeItems.Add(item);
        await _db.SaveChangesAsync();
        return item;
    }

    public async Task UpdateChequeItemAsync(ChequeItem item)
    {
        _db.ChequeItems.Update(item);
        await _db.SaveChangesAsync();
    }

    public async Task<int> GetNextBatchSeqNoAsync(long batchId)
    {
        var max = await _db.ChequeItems
            .Where(c => c.BatchId == batchId && !c.IsDeleted)
            .MaxAsync(c => (int?)c.SeqNo);
        return (max ?? 0) + 1;
    }

    public async Task<int> GetNextChqSeqAsync(int slipEntryId)
    {
        var max = await _db.ChequeItems
            .Where(c => c.SlipEntryId == slipEntryId && !c.IsDeleted)
            .MaxAsync(c => (int?)c.ChqSeq);
        return (max ?? 0) + 1;
    }

    public async Task<bool> AllRRResolvedAsync(long batchId) =>
        !await _db.ChequeItems.AnyAsync(c =>
            c.BatchId == batchId &&
            !c.IsDeleted &&
            c.RRState == (int)RRState.NeedsReview);

    // ─── SlipNo generation ────────────────────────────────────────────────────
    // Format: {BatchDailySeq:3}{ScannerIdSuffix:2}{SlipSeq:2} = 7 digits
    // Uses UPDLOCK on BatchSlipSequence to prevent race conditions.
    public async Task<string> GenerateNextSlipNoAsync(long batchId, int locationId, int? scannerMappingId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Get or create the per-batch sequence row with an update lock
            var seqRow = await _db.BatchSlipSequences
                .FromSqlRaw("SELECT * FROM BatchSlipSequences WITH (UPDLOCK) WHERE BatchId = {0}", batchId)
                .FirstOrDefaultAsync();

            if (seqRow == null)
            {
                seqRow = new BatchSlipSequence { BatchId = batchId, LastSeqNo = 0 };
                _db.BatchSlipSequences.Add(seqRow);
            }

            seqRow.LastSeqNo++;
            if (seqRow.LastSeqNo > 99)
                throw new InvalidOperationException("Batch slip sequence exceeded maximum (99 slips per batch).");

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            // Extract batch daily seq from BatchNo — last 3 digits are the daily sequence
            var batch = await _db.Batches.AsNoTracking().FirstAsync(b => b.BatchID == batchId);
            var batchNo = batch.BatchNo ?? string.Empty;
            // BatchNo format: {PIFPrefix}{DDMMYYYY}{3-digit-seq} e.g. AHM14042026001
            var batchDailySeq = batchNo.Length >= 3
                ? batchNo[^3..]  // last 3 chars
                : batchNo.PadLeft(3, '0');

            // Take last 2 digits of ScannerID; default to "00" if no scanner
            string scannerSuffix = "00";
            if (scannerMappingId.HasValue)
            {
                var scanner = await _db.LocationScanners.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.ScannerMappingID == scannerMappingId.Value);
                if (scanner != null)
                {
                    var sid = scanner.ScannerID.PadLeft(2, '0');
                    scannerSuffix = sid[^2..];
                }
            }

            return $"{batchDailySeq}{scannerSuffix}{seqRow.LastSeqNo:D2}";
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
