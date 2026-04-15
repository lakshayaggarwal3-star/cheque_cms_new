// =============================================================================
// File        : AuditService.cs
// Project     : CPS — Cheque Processing System
// Module      : Audit
// Description : Writes audit log entries to AuditLog table — application-layer, not DB triggers.
// Created     : 2026-04-14
// =============================================================================

using System.Text.Json;
using CPS.API.Models;

namespace CPS.API.Services;

public class AuditService : IAuditService
{
    private readonly CpsDbContext _db;

    public AuditService(CpsDbContext db) => _db = db;

    public async Task LogAsync(string tableName, string recordId, string action,
        object? oldValues, object? newValues, int changedBy, string? ipAddress = null, string? sessionId = null)
    {
        var entry = new AuditLog
        {
            TableName = tableName,
            RecordID = recordId,
            Action = action,
            OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
            NewValues = newValues != null ? JsonSerializer.Serialize(newValues) : null,
            ChangedBy = changedBy,
            ChangedAt = DateTime.UtcNow,
            IPAddress = ipAddress,
            SessionID = sessionId
        };
        _db.AuditLogs.Add(entry);
        await _db.SaveChangesAsync();
    }
}
