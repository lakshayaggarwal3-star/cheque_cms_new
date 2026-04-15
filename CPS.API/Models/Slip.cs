// =============================================================================
// File        : Slip.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : EF Core entity for deposit slip records within a batch.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class Slip
{
    [Key]
    public int SlipID { get; set; }

    public long BatchID { get; set; }

    [ForeignKey(nameof(BatchID))]
    public Batch Batch { get; set; } = null!;

    [Required, MaxLength(20)]
    public string SlipNo { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? ClientCode { get; set; }

    [MaxLength(200)]
    public string? ClientName { get; set; }

    [MaxLength(50)]
    public string? DepositSlipNo { get; set; }

    [MaxLength(20)]
    public string? PickupPoint { get; set; }

    public int TotalInstruments { get; set; } = 0;
    public decimal SlipAmount { get; set; } = 0;

    [MaxLength(500)]
    public string? Remarks { get; set; }

    public int SlipStatus { get; set; } = 0;

    public int CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;

    [Timestamp]
    public byte[] RowVersion { get; set; } = null!;

    public ICollection<ScanItem> ScanItems { get; set; } = new List<ScanItem>();
}
