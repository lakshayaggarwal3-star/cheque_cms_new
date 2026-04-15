// =============================================================================
// File        : LocationFinance.cs
// Project     : CPS — Cheque Processing System
// Module      : Location Master
// Description : EF Core entity for location financial/banking details.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class LocationFinance
{
    [Key]
    public int FinanceID { get; set; }

    public int LocationID { get; set; }

    [ForeignKey(nameof(LocationID))]
    public Location Location { get; set; } = null!;

    [MaxLength(20)]
    public string? BOFD { get; set; }

    [MaxLength(20)]
    public string? PreTrun { get; set; }

    [MaxLength(30)]
    public string? DepositAccount { get; set; }

    [MaxLength(15)]
    public string? IFSC { get; set; }

    public int? CreatedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
