// =============================================================================
// File        : ScanItem.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : EF Core entity for individual scanned cheque and slip images with MICR data.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class ScanItem
{
    [Key]
    public long ScanID { get; set; }

    public long BatchID { get; set; }

    [ForeignKey(nameof(BatchID))]
    public Batch Batch { get; set; } = null!;

    public int SeqNo { get; set; }

    public bool IsSlip { get; set; } = false;

    public int? SlipID { get; set; }

    [ForeignKey(nameof(SlipID))]
    public Slip? Slip { get; set; }

    [MaxLength(500)]
    public string? ImageFrontPath { get; set; }

    [MaxLength(500)]
    public string? ImageBackPath { get; set; }

    [MaxLength(100)]
    public string? MICRRaw { get; set; }

    [MaxLength(10)]
    public string? ChqNo { get; set; }

    [MaxLength(15)]
    public string? MICR1 { get; set; }

    [MaxLength(15)]
    public string? MICR2 { get; set; }

    [MaxLength(5)]
    public string? MICR3 { get; set; }

    [MaxLength(20)]
    public string? ScannerType { get; set; }

    [MaxLength(10)]
    public string? ScanType { get; set; }

    public int RRState { get; set; } = 0;

    public int? RRBy { get; set; }
    public DateTime? RRTime { get; set; }

    [MaxLength(10)]
    public string? MICRRepairFlag { get; set; }

    [MaxLength(20)]
    public string ScanStatus { get; set; } = "Pending";

    [MaxLength(500)]
    public string? ScanError { get; set; }

    public int RetryCount { get; set; } = 0;

    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;
}
