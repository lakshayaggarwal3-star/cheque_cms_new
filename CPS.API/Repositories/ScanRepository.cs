// =============================================================================
// File        : ScanRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : EF Core implementation of IScanRepository.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class ScanRepository : IScanRepository
{
    private readonly CpsDbContext _db;

    public ScanRepository(CpsDbContext db) => _db = db;

    public async Task<ScanItem?> GetByIdAsync(long scanId) =>
        await _db.ScanItems
            .Include(s => s.Slip)
            .FirstOrDefaultAsync(s => s.ScanID == scanId);

    public async Task<List<ScanItem>> GetByBatchAsync(long batchId) =>
        await _db.ScanItems
            .Where(s => s.BatchID == batchId)
            .OrderBy(s => s.SeqNo)
            .ToListAsync();

    public async Task<List<ScanItem>> GetRRItemsAsync(long batchId) =>
        await _db.ScanItems
            .Include(s => s.Slip)
            .Where(s => s.BatchID == batchId)
            .OrderBy(s => s.SeqNo)
            .ToListAsync();

    public async Task<ScanItem> CreateAsync(ScanItem item)
    {
        _db.ScanItems.Add(item);
        await _db.SaveChangesAsync();
        return item;
    }

    public async Task UpdateAsync(ScanItem item)
    {
        _db.ScanItems.Update(item);
        await _db.SaveChangesAsync();
    }

    public async Task<int> GetNextSeqNoAsync(long batchId)
    {
        var max = await _db.ScanItems
            .Where(s => s.BatchID == batchId)
            .MaxAsync(s => (int?)s.SeqNo);
        return (max ?? 0) + 1;
    }

    public async Task<bool> AllCapturedAsync(long batchId) =>
        !await _db.ScanItems.AnyAsync(s =>
            s.BatchID == batchId && s.ScanStatus != "Captured");

    public async Task<bool> AllRRResolvedAsync(long batchId) =>
        !await _db.ScanItems.AnyAsync(s =>
            s.BatchID == batchId &&
            !s.IsSlip &&
            s.RRState == (int)RRState.NeedsReview);
}
