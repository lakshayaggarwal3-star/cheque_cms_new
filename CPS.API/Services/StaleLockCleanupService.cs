// =============================================================================
// File        : StaleLockCleanupService.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch / Scanning / RR
// Description : Background service that proactively releases stale scan and RR locks every 2 minutes.
// Created     : 2026-05-03
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Services;

/// <summary>
/// Sweeps the Batch table every 2 minutes and releases any scan or RR lock that has been
/// held for longer than the stale threshold (7 minutes). This covers the case where a user
/// closes the browser or navigates away without triggering the explicit release API, and no
/// second user ever attempts to acquire the same lock (which is the only other release path).
/// </summary>
public class StaleLockCleanupService : BackgroundService
{
    private static readonly TimeSpan SweepInterval    = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan StaleLockTimeout = TimeSpan.FromMinutes(7);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<StaleLockCleanupService> _logger;

    public StaleLockCleanupService(IServiceScopeFactory scopeFactory, ILogger<StaleLockCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Stagger startup so it doesn't race with app init
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReleaseStaleLocks();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "StaleLockCleanup: unhandled error during sweep.");
            }

            await Task.Delay(SweepInterval, stoppingToken);
        }
    }

    private async Task ReleaseStaleLocks()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CpsDbContext>();

        var cutoff = DateTime.UtcNow - StaleLockTimeout;

        var staleBatches = await db.Batches
            .Where(b => !b.IsDeleted &&
                        ((b.ScanLockedBy != null && b.ScanLockedAt < cutoff) ||
                         (b.RRLockedBy   != null && b.RRLockedAt   < cutoff)))
            .ToListAsync();

        if (staleBatches.Count == 0)
            return;

        var now = DateTime.UtcNow;
        var released = new List<string>();

        foreach (var batch in staleBatches)
        {
            if (batch.ScanLockedBy != null && batch.ScanLockedAt < cutoff)
            {
                var heldMinutes = (now - batch.ScanLockedAt!.Value).TotalMinutes;
                _logger.LogWarning(
                    "StaleLockCleanup: releasing stale scan lock on batch {BatchId} held by user {UserId} for {Minutes:F1} min.",
                    batch.BatchID, batch.ScanLockedBy, heldMinutes);

                batch.StatusHistory = BatchHistory.Append(
                    batch.StatusHistory, "ScanReleased", batch.ScanLockedBy.Value,
                    $"Stale lock auto-released after {heldMinutes:F0} min (background cleanup)");

                // Downgrade status only if still showing as actively scanning
                if (batch.BatchStatus == (int)BatchStatus.ScanningInProgress)
                    batch.BatchStatus = (int)BatchStatus.ScanningPending;

                batch.ScanLockedBy = null;
                batch.ScanLockedAt = null;
                batch.UpdatedAt    = now;
                released.Add($"Batch {batch.BatchID} (scan)");
            }

            if (batch.RRLockedBy != null && batch.RRLockedAt < cutoff)
            {
                var heldMinutes = (now - batch.RRLockedAt!.Value).TotalMinutes;
                _logger.LogWarning(
                    "StaleLockCleanup: releasing stale RR lock on batch {BatchId} held by user {UserId} for {Minutes:F1} min.",
                    batch.BatchID, batch.RRLockedBy, heldMinutes);

                batch.StatusHistory = BatchHistory.Append(
                    batch.StatusHistory, "RRReleased", batch.RRLockedBy.Value,
                    $"Stale lock auto-released after {heldMinutes:F0} min (background cleanup)");

                if (batch.BatchStatus == (int)BatchStatus.RRInProgress)
                    batch.BatchStatus = (int)BatchStatus.RRPending;

                batch.RRLockedBy = null;
                batch.RRLockedAt = null;
                batch.UpdatedAt  = now;
                released.Add($"Batch {batch.BatchID} (RR)");
            }
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("StaleLockCleanup: released {Count} stale lock(s): {Batches}",
            released.Count, string.Join(", ", released));
    }
}
