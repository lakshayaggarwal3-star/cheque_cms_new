// =============================================================================
// File        : SessionValidationMiddleware.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth / Middleware
// Description : Enforces single-session logic by validating the JWT's sessionToken
//               claim against the current token stored in the database.
// Created     : 2026-04-28
// =============================================================================

using System.Security.Claims;
using CPS.API.Repositories;
using Microsoft.Extensions.Caching.Memory;

namespace CPS.API.Middleware;

public class SessionValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SessionValidationMiddleware> _logger;

    public SessionValidationMiddleware(RequestDelegate next, ILogger<SessionValidationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IUserRepository userRepository, IMemoryCache cache)
    {
        // 1. Skip if not an API request or if it's the login endpoint
        // This allows the React app to load and users to log back in even if they have an old session cookie.
        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api") || path.StartsWithSegments("/api/auth/login"))
        {
            await _next(context);
            return;
        }

        // 2. Skip if not authenticated or no sessionToken claim
        var user = context.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var userIdClaim = user.FindFirst("userId")?.Value;
        var sessionTokenClaim = user.FindFirst("sessionToken")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || string.IsNullOrEmpty(sessionTokenClaim))
        {
            // Allow requests without these claims to proceed (might be basic auth or system tasks)
            await _next(context);
            return;
        }

        if (!int.TryParse(userIdClaim, out int userId))
        {
            await _next(context);
            return;
        }

        // 2. Check cache first to avoid DB hit on every request
        string cacheKey = $"session_token_{userId}";
        if (cache.TryGetValue(cacheKey, out string? cachedToken))
        {
            if (cachedToken == sessionTokenClaim)
            {
                await _next(context);
                return;
            }
        }

        // 3. Check Database
        var dbUser = await userRepository.GetByIdAsync(userId);
        if (dbUser == null || !dbUser.IsLoggedIn || dbUser.SessionToken == null)
        {
            _logger.LogWarning("Session validation failed — User {UserId} is not logged in or doesn't exist.", userId);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { message = "Session expired or user logged out." });
            return;
        }

        var currentDbToken = dbUser.SessionToken.ToString();

        // 4. Validate
        if (currentDbToken != sessionTokenClaim)
        {
            _logger.LogInformation("Force Logout: User {UserId} session token mismatch. JWT: {JwtToken}, DB: {DbToken}", 
                userId, sessionTokenClaim, currentDbToken);
            
            context.Response.Headers.Append("X-Session-Conflict", "true");
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { message = "Session Terminated: A new login was detected on another device." });
            return;
        }

        // 5. Update cache (short duration)
        cache.Set(cacheKey, currentDbToken, TimeSpan.FromMinutes(2));

        await _next(context);
    }
}
