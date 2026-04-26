// =============================================================================
// File        : IUserSettingRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : User Settings
// Description : Repository interface for per-user key-value settings.
// Created     : 2026-04-24
// =============================================================================

namespace CPS.API.Repositories;

public interface IUserSettingRepository
{
    Task<string?> GetAsync(int userId, string key);
    Task<Dictionary<string, string>> GetAllAsync(int userId);
    Task UpsertAsync(int userId, string key, string value);
}
