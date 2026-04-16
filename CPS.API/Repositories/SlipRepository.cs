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

    public async Task<string> GenerateNextSlipNoAsync(int locationId, int? scannerMappingId)
    {
        // Scanner ID is required for slip number generation
        if (!scannerMappingId.HasValue)
            throw new InvalidOperationException("Scanner ID is required to generate Slip No");

        var scanner = await _db.LocationScanners.FirstOrDefaultAsync(s => s.ScannerMappingID == scannerMappingId)
            ?? throw new InvalidOperationException($"Scanner {scannerMappingId} not found");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Get or create SlipSequence for today+location+scanner
        var seq = await _db.SlipSequences.FirstOrDefaultAsync(s =>
            s.SlipDate == today &&
            s.LocationID == locationId &&
            s.ScannerMappingID == scannerMappingId);

        if (seq == null)
        {
            seq = new SlipSequence
            {
                SlipDate = today,
                LocationID = locationId,
                ScannerMappingID = scannerMappingId,
                LastSeqNo = 0
            };
            _db.SlipSequences.Add(seq);
        }

        // Increment sequence
        seq.LastSeqNo++;
        if (seq.LastSeqNo > 99)
            throw new InvalidOperationException("Daily slip sequence exceeded (max 99)");

        await _db.SaveChangesAsync();

        // Generate SlipNo: {ScannerID}{2-digit-seq} (e.g., 38501, 38502)
        var slipNo = $"{scanner.ScannerID:D}{seq.LastSeqNo:D2}";
        return slipNo;
    }
}
