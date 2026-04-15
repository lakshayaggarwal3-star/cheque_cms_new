// =============================================================================
// File        : LocationRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Location Master
// Description : EF Core implementation of ILocationRepository.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class LocationRepository : ILocationRepository
{
    private readonly CpsDbContext _db;

    public LocationRepository(CpsDbContext db) => _db = db;

    public async Task<List<Location>> GetAllAsync() =>
        await _db.Locations
            .Include(l => l.Scanners.Where(s => s.IsActive))
            .Include(l => l.Finance)
            .Where(l => !l.IsDeleted)
            .OrderBy(l => l.LocationName)
            .ToListAsync();

    public async Task<Location?> GetByIdAsync(int locationId) =>
        await _db.Locations
            .Include(l => l.Scanners.Where(s => s.IsActive))
            .Include(l => l.Finance)
            .FirstOrDefaultAsync(l => l.LocationID == locationId && !l.IsDeleted);

    public async Task<Location?> GetByCodeAsync(string code) =>
        await _db.Locations
            .FirstOrDefaultAsync(l => l.LocationCode == code && !l.IsDeleted);

    public async Task<List<LocationScanner>> GetScannersAsync(int locationId) =>
        await _db.LocationScanners
            .Where(s => s.LocationID == locationId && s.IsActive)
            .ToListAsync();

    public async Task<Location> CreateAsync(Location location)
    {
        _db.Locations.Add(location);
        await _db.SaveChangesAsync();
        return location;
    }

    public async Task UpdateAsync(Location location)
    {
        _db.Locations.Update(location);
        await _db.SaveChangesAsync();
    }

    public async Task UpsertScannerAsync(LocationScanner scanner)
    {
        var existing = await _db.LocationScanners
            .FirstOrDefaultAsync(s => s.LocationID == scanner.LocationID && s.ScannerID == scanner.ScannerID);
        if (existing == null)
            _db.LocationScanners.Add(scanner);
        else
        {
            existing.ScannerModel = scanner.ScannerModel;
            existing.ScannerType = scanner.ScannerType;
            existing.IsActive = true;
            existing.UpdatedBy = scanner.UpdatedBy;
            existing.UpdatedAt = scanner.UpdatedAt;
        }
        await _db.SaveChangesAsync();
    }

    public async Task UpsertFinanceAsync(LocationFinance finance)
    {
        var existing = await _db.LocationFinances
            .FirstOrDefaultAsync(f => f.LocationID == finance.LocationID);
        if (existing == null)
            _db.LocationFinances.Add(finance);
        else
        {
            existing.BOFD = finance.BOFD;
            existing.PreTrun = finance.PreTrun;
            existing.DepositAccount = finance.DepositAccount;
            existing.IFSC = finance.IFSC;
            existing.UpdatedBy = finance.UpdatedBy;
            existing.UpdatedAt = finance.UpdatedAt;
        }
        await _db.SaveChangesAsync();
    }
}
