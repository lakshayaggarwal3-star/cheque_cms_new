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
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.UserID == userId && !u.IsDeleted);

    public async Task<UserMaster?> GetByLoginIdAsync(string loginId) =>
        await _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u =>
                (u.EmployeeID == loginId || u.Username == loginId) && !u.IsDeleted);

    public async Task<List<UserMaster>> GetAllAsync() =>
        await _db.Users
            .Include(u => u.DefaultLocation)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
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

    public async Task<List<Role>> GetAllRolesAsync() =>
        await _db.Roles.ToListAsync();

    public async Task<Role?> GetRoleByNameAsync(string roleName) =>
        await _db.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName);

    public async Task SyncUserRolesAsync(int userId, List<string> roleNames, bool isDeveloper)
    {
        var existing = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserID == userId)
            .ToListAsync();

        _db.UserRoles.RemoveRange(existing);

        var allRoles = await _db.Roles.ToListAsync();
        
        var toAdd = roleNames
            .Select(name => allRoles.FirstOrDefault(r => r.RoleName == name))
            .Where(r => r != null)
            .Select(r => new UserRole { UserID = userId, RoleID = r!.RoleID })
            .ToList();

        if (isDeveloper)
        {
            var devRole = allRoles.FirstOrDefault(r => r.RoleName == "Developer");
            if (devRole != null && !toAdd.Any(ur => ur.RoleID == devRole.RoleID))
            {
                toAdd.Add(new UserRole { UserID = userId, RoleID = devRole.RoleID });
            }
        }

        if (toAdd.Any())
        {
            _db.UserRoles.AddRange(toAdd);
        }

        await _db.SaveChangesAsync();
    }
}
