// =============================================================================
// File        : ChequeItem.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Individual cheque scan record linked to a SlipEntry with separate scanner and RR MICR fields.
// Created     : 2026-04-17
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class ChequeItem
{
    [Key]
    public long ChequeItemId { get; set; }

    public long SlipEntryId { get; set; }

    [ForeignKey(nameof(SlipEntryId))]
    public SlipEntry SlipEntry { get; set; } = null!;

    // Denormalized for fast batch-level queries
    public long BatchId { get; set; }

    [ForeignKey(nameof(BatchId))]
    public Batch Batch { get; set; } = null!;

    // Sequential position within the batch (global order)
    public int SeqNo { get; set; }

    // Sequential position within the slip
    public int ChqSeq { get; set; }

    [MaxLength(10)]
    public string? ChqNo { get; set; }

    [MaxLength(10)]
    public string? ScanChqNo { get; set; }

    [MaxLength(10)]
    public string? RRChqNo { get; set; }

    [MaxLength(100)]
    public string? MICRRaw { get; set; }

    [MaxLength(100)]
    public string? ScanMICRRaw { get; set; }

    // --- Scanner MICR (raw data from hardware, never overwritten) ---
    [MaxLength(15)]
    public string? ScanMICR1 { get; set; }

    [MaxLength(15)]
    public string? ScanMICR2 { get; set; }

    [MaxLength(5)]
    public string? ScanMICR3 { get; set; }

    // --- RR MICR (set during Review & Repair, stored separately) ---
    [MaxLength(15)]
    public string? RRMICR1 { get; set; }

    [MaxLength(15)]
    public string? RRMICR2 { get; set; }

    [MaxLength(5)]
    public string? RRMICR3 { get; set; }

    // --- Final / Effective MICR (used for reporting and clearing) ---
    [MaxLength(15)]
    public string? MICR1 { get; set; }

    [MaxLength(15)]
    public string? MICR2 { get; set; }

    [MaxLength(5)]
    public string? MICR3 { get; set; }

    [MaxLength(500)]
    public string? RRNotes { get; set; }

    // 0 = NeedsReview, 1 = Approved, 2 = Repaired
    public int RRState { get; set; } = 0;

    // --- Auditing: Scanner ---
    public DateTime? ScannerStartedAt { get; set; }
    public int? ScannerCompletedBy { get; set; }
    public DateTime? ScannerCompletedAt { get; set; }

    // --- Auditing: RR ---
    public DateTime? RRStartedAt { get; set; }
    public int? RRCompletedBy { get; set; }
    public DateTime? RRCompletedAt { get; set; }


    // Optimization: Store base path and derive suffixes (SF, CF, CR)

    // Optimization: Store base path and derive suffixes (SF, CF, CR)
    [MaxLength(500)]
    public string? ImageBaseName { get; set; }

    [MaxLength(200)]
    public string? ImageName { get; set; }

    [MaxLength(10)]
    public string? FileExtension { get; set; }

    [MaxLength(64)]
    public string? ImageHash { get; set; }

    // Pending / Captured / Failed / RetryPending
    [MaxLength(20)]
    public string ScanStatus { get; set; } = "Pending";

    [MaxLength(500)]
    public string? ScanError { get; set; }

    public int RetryCount { get; set; } = 0;

    [MaxLength(50)]
    public string? ScannerType { get; set; }

    // Scan / Rescan
    [MaxLength(10)]
    public string? ScanType { get; set; }

    [MaxLength(20)]
    public string? EntryMode { get; set; }

    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;
}
