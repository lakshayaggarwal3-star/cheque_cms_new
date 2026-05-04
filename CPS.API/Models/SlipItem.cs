// =============================================================================
// File        : SlipItem.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Physical slip scan image record — 0 to N per SlipEntry (with-slip mode only).
// Created     : 2026-04-17
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class SlipItem
{
    [Key]
    public long SlipItemId { get; set; }

    public long SlipEntryId { get; set; }

    [ForeignKey(nameof(SlipEntryId))]
    public SlipEntry SlipEntry { get; set; } = null!;

    // Order of this scan image within the slip (1, 2, 3...)
    public int ScanOrder { get; set; } = 1;

    [MaxLength(500)]
    public string? ImageBaseName { get; set; }

    [MaxLength(200)]
    public string? ImageName { get; set; }

    [MaxLength(10)]
    public string? FileExtension { get; set; }

    [MaxLength(64)]
    public string? ImageHash { get; set; }

    // Original path before mapping from the global bucket — preserved for audit/traceability
    [MaxLength(500)]
    public string? GlobalImageBaseName { get; set; }

    [MaxLength(200)]
    public string? GlobalImageName { get; set; }

    // Pending / Captured / Failed / RetryPending
    [MaxLength(20)]
    public string ScanStatus { get; set; } = "Pending";

    [MaxLength(500)]
    public string? ScanError { get; set; }

    public int RetryCount { get; set; } = 0;

    [MaxLength(50)]
    public string? ScannerType { get; set; }

    [MaxLength(20)]
    public string? EntryMode { get; set; }

    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
}
