// =============================================================================
// File        : SlipScan.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Physical slip scan image record — 0 to N per SlipEntry (with-slip mode only).
// Created     : 2026-04-17
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class SlipScan
{
    [Key]
    public long SlipScanId { get; set; }

    public int SlipEntryId { get; set; }

    [ForeignKey(nameof(SlipEntryId))]
    public SlipEntry SlipEntry { get; set; } = null!;

    // Order of this scan image within the slip (1, 2, 3...)
    public int ScanOrder { get; set; } = 1;

    [MaxLength(500)]
    public string? ImagePath { get; set; }

    // Pending / Captured / Failed / RetryPending
    [MaxLength(20)]
    public string ScanStatus { get; set; } = "Pending";

    [MaxLength(500)]
    public string? ScanError { get; set; }

    public int RetryCount { get; set; } = 0;

    [MaxLength(50)]
    public string? ScannerType { get; set; }

    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
}
