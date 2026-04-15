// =============================================================================
// File        : IAuditService.cs
// Project     : CPS — Cheque Processing System
// Module      : Audit
// Description : Service interface for writing banking compliance audit log entries.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.Services;

public interface IAuditService
{
    Task LogAsync(string tableName, string recordId, string action,
        object? oldValues, object? newValues, int changedBy, string? ipAddress = null, string? sessionId = null);
}
