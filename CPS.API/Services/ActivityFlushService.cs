// =============================================================================
// File        : ActivityFlushService.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth / Session
// Description : Background service that flushes in-memory LastActiveAt timestamps to the DB every 20 minutes.
// Created     : 2026-05-03
// =============================================================================

using CPS.API.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CPS.API.Services;

public class ActivityFlushService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ActivityFlushService> _logger;

    private static readonly TimeSpan FlushInterval = TimeSpan.FromMinutes(20);
    public const string CacheKeyPrefix = "last_active_";

    public ActivityFlushService(IServiceScopeFactory scopeFactory, IMemoryCache cache, ILogger<ActivityFlushService> logger)
    {
        _scopeFactory = scopeFactory;
        _cache = cache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(FlushInterval, stoppingToken);
            await FlushAsync();
        }
    }

    private async Task FlushAsync()
    {
        // IMemoryCache has no enumeration API — we track dirty user IDs in a separate cache key
        if (!_cache.TryGetValue("activity_dirty_users", out HashSet<int>? dirtyUsers) || dirtyUsers == null || dirtyUsers.Count == 0)
            return;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CpsDbContext>();

        foreach (var userId in dirtyUsers.ToList())
        {
            var cacheKey = $"{CacheKeyPrefix}{userId}";
            if (!_cache.TryGetValue(cacheKey, out DateTime lastActive)) continue;

            var user = await db.Users.FindAsync(userId);
            if (user == null) continue;

            user.LastActiveAt = lastActive;
            user.UpdatedAt = DateTime.UtcNow;
        }

        try
        {
            await db.SaveChangesAsync();
            _cache.Remove("activity_dirty_users");
            _logger.LogInformation("ActivityFlush: flushed {Count} user activity timestamps to DB.", dirtyUsers.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ActivityFlush: failed to flush activity timestamps.");
        }
    }

    /// <summary>Called by middleware to record activity without hitting the DB.</summary>
    public void RecordActivity(int userId)
    {
        var now = DateTime.UtcNow;
        var cacheKey = $"{CacheKeyPrefix}{userId}";
        _cache.Set(cacheKey, now, TimeSpan.FromHours(2));

        // Track dirty set
        var dirty = _cache.GetOrCreate("activity_dirty_users", e =>
        {
            e.SlidingExpiration = TimeSpan.FromHours(2);
            return new HashSet<int>();
        })!;

        lock (dirty) { dirty.Add(userId); }
    }

    /// <summary>Returns the most recent LastActiveAt for a user — cache first, then null (DB check is caller's job).</summary>
    public DateTime? GetCachedLastActive(int userId)
    {
        var cacheKey = $"{CacheKeyPrefix}{userId}";
        return _cache.TryGetValue(cacheKey, out DateTime ts) ? ts : null;
    }
}
