// =============================================================================
// File        : IUserRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : Repository interface for UserMaster and UserLocationHistory DB operations.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface IUserRepository
{
    Task<UserMaster?> GetByIdAsync(int userId);
    Task<UserMaster?> GetByLoginIdAsync(string loginId);
    Task<List<UserMaster>> GetAllAsync();
    Task<UserMaster> CreateAsync(UserMaster user);
    Task UpdateAsync(UserMaster user);
    Task<bool> ExistsEmployeeIdAsync(string employeeId, int? excludeUserId = null);
    Task<bool> ExistsUsernameAsync(string username, int? excludeUserId = null);
    Task<Location?> GetCurrentLocationAsync(int userId, DateOnly date);
    Task AddLocationHistoryAsync(UserLocationHistory history);
}
