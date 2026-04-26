// =============================================================================
// File        : UserSettingRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : User Settings
// Description : EF Core implementation for per-user key-value settings (upsert pattern).
// Created     : 2026-04-24
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class UserSettingRepository : IUserSettingRepository
{
    private readonly CpsDbContext _db;

    public UserSettingRepository(CpsDbContext db) => _db = db;

    public async Task<string?> GetAsync(int userId, string key) =>
        await _db.UserSettings
            .Where(s => s.UserID == userId && s.SettingKey == key)
            .Select(s => s.SettingValue)
            .FirstOrDefaultAsync();

    public async Task<Dictionary<string, string>> GetAllAsync(int userId) =>
        await _db.UserSettings
            .Where(s => s.UserID == userId)
            .ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue);

    public async Task UpsertAsync(int userId, string key, string value)
    {
        var existing = await _db.UserSettings
            .FirstOrDefaultAsync(s => s.UserID == userId && s.SettingKey == key);

        if (existing == null)
        {
            _db.UserSettings.Add(new UserSetting
            {
                UserID = userId,
                SettingKey = key,
                SettingValue = value,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.SettingValue = value;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }
}
