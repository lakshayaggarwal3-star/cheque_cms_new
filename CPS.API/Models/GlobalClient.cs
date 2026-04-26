// =============================================================================
// File        : GlobalClient.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : A logical grouping entity that links multiple ClientMaster records
//               (which may have different city codes / names) to a single real-world
//               organisation. When IsPriority is true, all slips in a batch that
//               contain a client belonging to this global group must belong to the
//               SAME global group — no mixing allowed.
// Created     : 2026-04-22
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class GlobalClient
{
    [Key]
    public int GlobalClientID { get; set; }

    /// <summary>Short code used for grouping (e.g. "ABBOTT", "PFIZER"). Must be unique.</summary>
    [Required, MaxLength(50)]
    public string GlobalCode { get; set; } = string.Empty;

    /// <summary>Human-readable full name of the organisation.</summary>
    [Required, MaxLength(300)]
    public string GlobalName { get; set; } = string.Empty;

    /// <summary>
    /// When true, any batch that has a slip belonging to this global client
    /// must contain ONLY slips belonging to this global client.
    /// </summary>
    public bool IsPriority { get; set; } = false;

    public bool IsActive { get; set; } = true;

    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<ClientMaster> Clients { get; set; } = new List<ClientMaster>();
}
