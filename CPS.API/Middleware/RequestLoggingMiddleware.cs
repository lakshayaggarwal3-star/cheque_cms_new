// =============================================================================
// File        : RequestLoggingMiddleware.cs
// Project     : CPS — Cheque Processing System
// Module      : Middleware
// Description : Logs every API request with method, path, userId, and duration.
// Created     : 2026-04-14
// =============================================================================

using System.Diagnostics;
using System.Security.Claims;

namespace CPS.API.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        var correlationId = Activity.Current?.Id ?? Guid.NewGuid().ToString("N")[..12];
        context.Items["CorrelationId"] = correlationId;

        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            var userId = context.User?.FindFirstValue("userId") ?? "anon";
            _logger.LogInformation(
                "HTTP {Method} {Path} → {StatusCode} | User:{UserId} | {Duration}ms | CID:{CorrelationId}",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                userId,
                sw.ElapsedMilliseconds,
                correlationId);
        }
    }
}
