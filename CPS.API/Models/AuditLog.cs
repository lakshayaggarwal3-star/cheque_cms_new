// =============================================================================
// File        : AuditLog.cs
// Project     : CPS — Cheque Processing System
// Module      : Audit
// Description : EF Core entity for banking compliance audit trail of all data changes.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class AuditLog
{
    [Key]
    public long AuditID { get; set; }

    [Required, MaxLength(100)]
    public string TableName { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string RecordID { get; set; } = string.Empty;

    [Required, MaxLength(30)]
    public string Action { get; set; } = string.Empty;

    public string? OldValues { get; set; }
    public string? NewValues { get; set; }

    public int ChangedBy { get; set; }
    public DateTime ChangedAt { get; set; }

    [MaxLength(50)]
    public string? BatchNo { get; set; }
}
