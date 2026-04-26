// =============================================================================
// File        : SlipEntry.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Logical slip record — always exists even in without-slip scan mode.
// Created     : 2026-04-17
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class SlipEntry
{
    [Key]
    public long SlipEntryId { get; set; }

    public long BatchId { get; set; }

    [ForeignKey(nameof(BatchId))]
    public Batch Batch { get; set; } = null!;

    // 7-digit: {BatchDailySeq:3}{ScannerIdSuffix:2}{SlipSeq:2}  e.g. 0018501
    [Required, MaxLength(10)]
    public string SlipNo { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? ClientCode { get; set; }

    [MaxLength(200)]
    public string? ClientName { get; set; }

    [MaxLength(50)]
    public string? DepositSlipNo { get; set; }

    [MaxLength(100)]
    public string? PickupPoint { get; set; }

    public int TotalInstruments { get; set; } = 0;

    [Column(TypeName = "decimal(15,3)")]
    public decimal SlipAmount { get; set; } = 0;

    [MaxLength(500)]
    public string? Remarks { get; set; }

    // 0 = Open, 1 = Complete
    public int SlipStatus { get; set; } = 0;

    // Track last cheque sequence number within this slip
    public int LastChqSeq { get; set; } = 0;

    public DateTime? EntryCompletedAt { get; set; }

    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
    public int? DeletedBy { get; set; }
    public DateTime? DeletedAt { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;

    public ICollection<SlipItem> SlipItems { get; set; } = new List<SlipItem>();
    public ICollection<ChequeItem> ChequeItems { get; set; } = new List<ChequeItem>();
}
