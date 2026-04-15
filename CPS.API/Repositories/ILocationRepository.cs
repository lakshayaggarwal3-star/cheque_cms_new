// =============================================================================
// File        : ILocationRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Location Master
// Description : Repository interface for location, scanner, and finance DB operations.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface ILocationRepository
{
    Task<List<Location>> GetAllAsync();
    Task<Location?> GetByIdAsync(int locationId);
    Task<Location?> GetByCodeAsync(string code);
    Task<List<LocationScanner>> GetScannersAsync(int locationId);
    Task<Location> CreateAsync(Location location);
    Task UpdateAsync(Location location);
    Task UpsertScannerAsync(LocationScanner scanner);
    Task UpsertFinanceAsync(LocationFinance finance);
}
