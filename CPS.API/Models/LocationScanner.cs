// =============================================================================
// File        : LocationScanner.cs
// Project     : CPS — Cheque Processing System
// Module      : Location Master
// Description : EF Core entity mapping scanners to locations.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class LocationScanner
{
    [Key]
    public int ScannerMappingID { get; set; }

    public int LocationID { get; set; }

    [ForeignKey(nameof(LocationID))]
    public Location Location { get; set; } = null!;

    [Required, MaxLength(20)]
    public string ScannerID { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ScannerModel { get; set; }

    [MaxLength(20)]
    public string? ScannerType { get; set; }

    public bool IsActive { get; set; } = true;

    public int? CreatedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
