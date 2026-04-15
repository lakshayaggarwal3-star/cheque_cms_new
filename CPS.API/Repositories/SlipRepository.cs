// =============================================================================
// File        : SlipRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : EF Core implementation of ISlipRepository.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class SlipRepository : ISlipRepository
{
    private readonly CpsDbContext _db;

    public SlipRepository(CpsDbContext db) => _db = db;

    public async Task<Slip?> GetByIdAsync(int slipId) =>
        await _db.Slips
            .Include(s => s.ScanItems)
            .FirstOrDefaultAsync(s => s.SlipID == slipId && !s.IsDeleted);

    public async Task<List<Slip>> GetByBatchAsync(long batchId) =>
        await _db.Slips
            .Where(s => s.BatchID == batchId && !s.IsDeleted)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync();

    public async Task<bool> SlipNoExistsAsync(long batchId, string slipNo, int? excludeSlipId = null) =>
        await _db.Slips.AnyAsync(s =>
            s.BatchID == batchId &&
            s.SlipNo == slipNo &&
            !s.IsDeleted &&
            (excludeSlipId == null || s.SlipID != excludeSlipId));

    public async Task<Slip> CreateAsync(Slip slip)
    {
        _db.Slips.Add(slip);
        await _db.SaveChangesAsync();
        return slip;
    }

    public async Task UpdateAsync(Slip slip)
    {
        _db.Slips.Update(slip);
        await _db.SaveChangesAsync();
    }
}
