// =============================================================================
// File        : SessionValidationMiddleware.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth / Middleware
// Description : Validates session token, enforces IsActive check, and enforces 30-minute inactivity timeout.
// Created     : 2026-04-28
// =============================================================================

using CPS.API.Repositories;
using CPS.API.Services;
using Microsoft.Extensions.Caching.Memory;

namespace CPS.API.Middleware;

public class SessionValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SessionValidationMiddleware> _logger;

    private static readonly TimeSpan InactivityLimit = TimeSpan.FromMinutes(30);

    public SessionValidationMiddleware(RequestDelegate next, ILogger<SessionValidationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IUserRepository userRepository, IMemoryCache cache, ActivityFlushService activityFlush)
    {
        var path = context.Request.Path;

        // Skip login — allow unauthenticated requests and non-API routes through
        if (!path.StartsWithSegments("/api") || path.StartsWithSegments("/api/auth/login"))
        {
            await _next(context);
            return;
        }

        var user = context.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var userIdClaim      = user.FindFirst("userId")?.Value;
        var sessionTokenClaim = user.FindFirst("sessionToken")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || string.IsNullOrEmpty(sessionTokenClaim) ||
            !int.TryParse(userIdClaim, out int userId))
        {
            await _next(context);
            return;
        }

        // ── 1. Session token check (cache first) ──────────────────────────────
        string sessionCacheKey = $"session_token_{userId}";
        bool sessionOk = false;

        if (cache.TryGetValue(sessionCacheKey, out string? cachedToken))
        {
            sessionOk = cachedToken == sessionTokenClaim;
        }

        // Always hit DB when cache misses — needed for IsActive + LastActiveAt too
        var dbUser = await userRepository.GetByIdAsync(userId);

        if (dbUser == null || !dbUser.IsLoggedIn || dbUser.SessionToken == null)
        {
            _logger.LogWarning("Session invalid — user {UserId} not logged in or missing.", userId);
            await RejectAsync(context, "Session expired. Please log in again.");
            return;
        }

        // ── 2. IsActive check — immediate logout if admin disabled the account ─
        if (!dbUser.IsActive)
        {
            _logger.LogWarning("Access denied — user {UserId} account is inactive.", userId);
            await RejectAsync(context, "Your account has been deactivated. Contact admin.");
            return;
        }

        // ── 3. Session token match ─────────────────────────────────────────────
        var dbToken = dbUser.SessionToken.ToString();
        if (!sessionOk && dbToken != sessionTokenClaim)
        {
            _logger.LogInformation("Session conflict — user {UserId}: JWT token doesn't match DB.", userId);
            context.Response.Headers.Append("X-Session-Conflict", "true");
            await RejectAsync(context, "Session terminated: a new login was detected on another device.");
            return;
        }

        // ── 4. Inactivity check — 30 minutes ──────────────────────────────────
        // Check cache first (most recent activity), fall back to DB column
        var lastActive = activityFlush.GetCachedLastActive(userId) ?? dbUser.LastActiveAt;

        if (lastActive.HasValue && DateTime.UtcNow - lastActive.Value > InactivityLimit)
        {
            _logger.LogInformation("Inactivity logout — user {UserId} idle for >{Limit}min.", userId, InactivityLimit.TotalMinutes);

            // Clean up server-side session
            dbUser.IsLoggedIn   = false;
            dbUser.SessionToken = null;
            dbUser.UpdatedAt    = DateTime.UtcNow;
            await userRepository.UpdateAsync(dbUser);
            cache.Remove(sessionCacheKey);

            await RejectAsync(context, "Session expired due to inactivity. Please log in again.");
            return;
        }

        // ── 5. All checks passed — refresh cache + record activity ────────────
        cache.Set(sessionCacheKey, dbToken, TimeSpan.FromMinutes(2));
        activityFlush.RecordActivity(userId);

        await _next(context);
    }

    private static Task RejectAsync(HttpContext context, string message)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return context.Response.WriteAsJsonAsync(new { success = false, message });
    }
}
