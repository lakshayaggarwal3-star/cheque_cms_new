// =============================================================================
// File        : GlobalExceptionMiddleware.cs
// Project     : CPS — Cheque Processing System
// Module      : Middleware
// Description : Catches all unhandled exceptions, logs them, and returns standardized error envelopes.
// Created     : 2026-04-14
// =============================================================================

using System.Net;
using System.Text.Json;
using CPS.API.Exceptions;

namespace CPS.API.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, errorCode, message, details) = exception switch
        {
            Exceptions.ValidationException ve => (HttpStatusCode.BadRequest, "VALIDATION_ERROR", ve.Message,
                ve.Errors.Select(e => new { field = e.Field, message = e.Message }).ToList<object>()),
            NotFoundException nfe => (HttpStatusCode.NotFound, "NOT_FOUND", nfe.Message, new List<object>()),
            ConflictException ce => (HttpStatusCode.Conflict, "CONFLICT", ce.Message, new List<object>()),
            ForbiddenException fe => (HttpStatusCode.Forbidden, "FORBIDDEN", fe.Message, new List<object>()),
            ScannerException se => (HttpStatusCode.ServiceUnavailable, "SCANNER_ERROR", se.Message, new List<object>()),
            _ => (HttpStatusCode.InternalServerError, "INTERNAL_ERROR",
                "An unexpected error occurred. Please try again or contact support.", new List<object>())
        };

        if (statusCode == HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception on {Method} {Path}",
                context.Request.Method, context.Request.Path);
        }
        else
        {
            _logger.LogWarning(exception, "{ErrorCode} on {Method} {Path}",
                errorCode, context.Request.Method, context.Request.Path);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var response = new
        {
            success = false,
            errorCode,
            message,
            details
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
