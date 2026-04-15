// =============================================================================
// File        : Batch.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : EF Core entity representing a cheque processing batch.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class Batch
{
    [Key]
    public long BatchID { get; set; }

    // Internal system batch number — legacy desktop style sequence format.
    // e.g. 00001, 00002
    [Required, MaxLength(20)]
    public string BatchNo { get; set; } = string.Empty;

    // Operator-entered PIF (Processing Instruction Form number) — typed from the physical paper form
    [MaxLength(30)]
    public string? PIF { get; set; }

    // Operator-entered Summary Reference Number — must equal PIF at save time
    [MaxLength(30)]
    public string? SummRefNo { get; set; }

    public int LocationID { get; set; }

    [ForeignKey(nameof(LocationID))]
    public Location Location { get; set; } = null!;

    public int? ScannerMappingID { get; set; }

    [ForeignKey(nameof(ScannerMappingID))]
    public LocationScanner? Scanner { get; set; }

    [MaxLength(20)]
    public string? PickupPointCode { get; set; }

    public DateOnly BatchDate { get; set; }

    [MaxLength(5)]
    public string ClearingType { get; set; } = "01";

    public bool IsPDC { get; set; } = false;
    public DateOnly? PDCDate { get; set; }
    public int TotalSlips { get; set; } = 0;
    public decimal TotalAmount { get; set; } = 0;

    [MaxLength(10)]
    public string ScanType { get; set; } = "Scan";

    public bool? WithSlip { get; set; }
    public int BatchStatus { get; set; } = 0;
    public string? StatusHistory { get; set; }

    // Scanning lock
    public int? ScanLockedBy { get; set; }
    public DateTime? ScanLockedAt { get; set; }

    // RR lock
    public int? RRLockedBy { get; set; }
    public DateTime? RRLockedAt { get; set; }

    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
    public int? DeletedBy { get; set; }
    public DateTime? DeletedAt { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;

    public ICollection<Slip> Slips { get; set; } = new List<Slip>();
    public ICollection<ScanItem> ScanItems { get; set; } = new List<ScanItem>();
}
