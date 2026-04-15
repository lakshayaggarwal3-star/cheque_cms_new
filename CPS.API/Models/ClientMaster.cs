// =============================================================================
// File        : ClientMaster.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : EF Core entity for client/company master data.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class ClientMaster
{
    [Key]
    public int ClientID { get; set; }

    [Required, MaxLength(20)]
    public string CityCode { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string ClientName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Address1 { get; set; }

    [MaxLength(200)]
    public string? Address2 { get; set; }

    [MaxLength(200)]
    public string? Address3 { get; set; }

    [MaxLength(200)]
    public string? Address4 { get; set; }

    [MaxLength(200)]
    public string? Address5 { get; set; }

    [MaxLength(20)]
    public string? PickupPointCode { get; set; }

    [MaxLength(200)]
    public string? PickupPointDesc { get; set; }

    [MaxLength(20)]
    public string? RCMSCode { get; set; }

    [MaxLength(1)]
    public string? Status { get; set; }

    public DateOnly? StatusDate { get; set; }

    public int? CreatedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
}
