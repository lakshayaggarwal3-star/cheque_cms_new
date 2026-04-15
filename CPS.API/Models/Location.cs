// =============================================================================
// File        : Location.cs
// Project     : CPS — Cheque Processing System
// Module      : Location Master
// Description : EF Core entity for branch/location master data.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class Location
{
    [Key]
    public int LocationID { get; set; }

    [Required, MaxLength(100)]
    public string LocationName { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string LocationCode { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? State { get; set; }

    [MaxLength(50)]
    public string? Grid { get; set; }

    [MaxLength(50)]
    public string? ClusterCode { get; set; }

    [MaxLength(100)]
    public string? Zone { get; set; }

    [MaxLength(20)]
    public string? LocType { get; set; }

    [MaxLength(10)]
    public string? PIFPrefix { get; set; }

    public bool IsActive { get; set; } = true;

    public int? CreatedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;

    public ICollection<LocationScanner> Scanners { get; set; } = new List<LocationScanner>();
    public LocationFinance? Finance { get; set; }
}
