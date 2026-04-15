// =============================================================================
// File        : UserLocationHistory.cs
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : EF Core entity tracking user location assignments over time.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class UserLocationHistory
{
    [Key]
    public int HistoryID { get; set; }

    public int UserID { get; set; }

    [ForeignKey(nameof(UserID))]
    public UserMaster User { get; set; } = null!;

    public int LocationID { get; set; }

    [ForeignKey(nameof(LocationID))]
    public Location Location { get; set; } = null!;

    public DateOnly AssignedDate { get; set; }

    public bool IsTemporary { get; set; } = false;

    public int? AssignedBy { get; set; }

    public DateTime CreatedAt { get; set; }
}
