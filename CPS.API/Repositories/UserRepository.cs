// =============================================================================
// File        : UserRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : EF Core implementation of IUserRepository.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class UserRepository : IUserRepository
{
    private readonly CpsDbContext _db;

    public UserRepository(CpsDbContext db) => _db = db;

    public async Task<UserMaster?> GetByIdAsync(int userId) =>
        await _db.Users
            .Include(u => u.DefaultLocation)
            .FirstOrDefaultAsync(u => u.UserID == userId && !u.IsDeleted);

    public async Task<UserMaster?> GetByLoginIdAsync(string loginId) =>
        await _db.Users
            .FirstOrDefaultAsync(u =>
                (u.EmployeeID == loginId || u.Username == loginId) && !u.IsDeleted);

    public async Task<List<UserMaster>> GetAllAsync() =>
        await _db.Users
            .Include(u => u.DefaultLocation)
            .Where(u => !u.IsDeleted)
            .OrderBy(u => u.EmployeeID)
            .ToListAsync();

    public async Task<UserMaster> CreateAsync(UserMaster user)
    {
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    public async Task UpdateAsync(UserMaster user)
    {
        _db.Users.Update(user);
        await _db.SaveChangesAsync();
    }

    public async Task<bool> ExistsEmployeeIdAsync(string employeeId, int? excludeUserId = null) =>
        await _db.Users.AnyAsync(u =>
            u.EmployeeID == employeeId &&
            !u.IsDeleted &&
            (excludeUserId == null || u.UserID != excludeUserId));

    public async Task<bool> ExistsUsernameAsync(string username, int? excludeUserId = null) =>
        await _db.Users.AnyAsync(u =>
            u.Username == username &&
            !u.IsDeleted &&
            (excludeUserId == null || u.UserID != excludeUserId));

    public async Task<Location?> GetCurrentLocationAsync(int userId, DateOnly date)
    {
        var history = await _db.UserLocationHistories
            .Include(h => h.Location)
            .Where(h => h.UserID == userId && h.AssignedDate <= date)
            .OrderByDescending(h => h.AssignedDate)
            .FirstOrDefaultAsync();

        if (history != null) return history.Location;

        var user = await _db.Users
            .Include(u => u.DefaultLocation)
            .FirstOrDefaultAsync(u => u.UserID == userId && !u.IsDeleted);

        return user?.DefaultLocation;
    }

    public async Task AddLocationHistoryAsync(UserLocationHistory history)
    {
        _db.UserLocationHistories.Add(history);
        await _db.SaveChangesAsync();
    }
}
