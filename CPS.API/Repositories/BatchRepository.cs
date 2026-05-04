// =============================================================================
// File        : BatchRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : EF Core implementation of IBatchRepository including locked sequence generation.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class BatchRepository : IBatchRepository
{
    private readonly CpsDbContext _db;

    public BatchRepository(CpsDbContext db) => _db = db;

    public async Task<Batch?> GetByIdAsync(long batchId) =>
        await _db.Batches
            .Include(b => b.Location)
            .Include(b => b.Scanner)
            .FirstOrDefaultAsync(b => b.BatchID == batchId && !b.IsDeleted);

    public async Task<Batch?> GetByNoAsync(string batchNo) =>
        await _db.Batches
            .Include(b => b.Location)
            .Include(b => b.Scanner)
            .FirstOrDefaultAsync(b => b.BatchNo == batchNo && !b.IsDeleted);

    public async Task<List<Batch>> GetListAsync(int? locationId, DateOnly? date, int? status, int page, int pageSize)
    {
        var query = _db.Batches
            .Include(b => b.Location)
            .Include(b => b.Scanner)
            .Where(b => !b.IsDeleted);

        if (locationId.HasValue && locationId.Value > 0)
            query = query.Where(b => b.LocationID == locationId.Value);
        if (date.HasValue)
            query = query.Where(b => b.BatchDate == date.Value);
        if (status.HasValue)
            query = query.Where(b => b.BatchStatus == status.Value);

        return await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> GetTotalCountAsync(int? locationId, DateOnly? date, int? status)
    {
        var query = _db.Batches.Where(b => !b.IsDeleted);
        if (locationId.HasValue && locationId.Value > 0) query = query.Where(b => b.LocationID == locationId.Value);
        if (date.HasValue) query = query.Where(b => b.BatchDate == date.Value);
        if (status.HasValue) query = query.Where(b => b.BatchStatus == status.Value);
        return await query.CountAsync();
    }

    public async Task<Batch> CreateAsync(Batch batch)
    {
        _db.Batches.Add(batch);
        await _db.SaveChangesAsync();
        return batch;
    }

    public async Task UpdateAsync(Batch batch)
    {
        _db.Batches.Update(batch);
        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Atomically increments or inserts the daily sequence for location+scanner+date.
    /// Uses raw SQL with UPDLOCK to prevent duplicate batch numbers.
    /// </summary>
    public async Task<int> GetNextSequenceAsync(DateOnly date, int locationId, int? scannerMappingId = null)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Update or insert sequence for this specific scanner at this location
            var updated = await _db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE BatchSequences WITH (UPDLOCK) SET LastSeqNo = LastSeqNo + 1 WHERE BatchDate = {date} AND LocationID = {locationId} AND ScannerMappingID = {scannerMappingId}");

            if (updated == 0)
            {
                await _db.Database.ExecuteSqlInterpolatedAsync(
                    $"INSERT INTO BatchSequences (BatchDate, LocationID, ScannerMappingID, LastSeqNo) VALUES ({date}, {locationId}, {scannerMappingId}, 1)");
            }

            var seq = await _db.BatchSequences
                .Where(s => s.BatchDate == date && s.LocationID == locationId && s.ScannerMappingID == scannerMappingId)
                .Select(s => s.LastSeqNo)
                .FirstAsync();

            await tx.CommitAsync();
            return seq;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    public async Task<DashboardCounts> GetDashboardCountsAsync(int locationId, DateOnly date)
    {
        var query = _db.Batches.Where(b => b.BatchDate == date && !b.IsDeleted);
        if (locationId > 0)
            query = query.Where(b => b.LocationID == locationId);
            
        var batches = await query
            .Select(b => b.BatchStatus)
            .ToListAsync();

        return new DashboardCounts
        {
            Total = batches.Count,
            ScanningPending = batches.Count(s => s == (int)BatchStatus.ScanningPending || s == (int)BatchStatus.ScanningInProgress),
            RRPending = batches.Count(s => s == (int)BatchStatus.RRPending || s == (int)BatchStatus.RRInProgress),
            MakerPending = batches.Count(s => s == (int)BatchStatus.MakerPending || s == (int)BatchStatus.MakerInProgress),
            CheckerPending = batches.Count(s => s == (int)BatchStatus.CheckerPending || s == (int)BatchStatus.CheckerInProgress),
            QCPending = batches.Count(s => s == (int)BatchStatus.QCPending || s == (int)BatchStatus.QCInProgress),
            Completed = batches.Count(s => s == (int)BatchStatus.QCCompleted) // Completed when final stage is done
        };
    }
}
