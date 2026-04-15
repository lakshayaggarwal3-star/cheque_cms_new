// =============================================================================
// File        : UserMaster.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth / User Management
// Description : EF Core entity for user accounts, roles, and session tracking.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class UserMaster
{
    [Key]
    public int UserID { get; set; }

    [Required, MaxLength(20)]
    public string EmployeeID { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required, MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Email { get; set; }

    public bool IsActive { get; set; } = true;
    public bool RoleScanner { get; set; } = false;
    public bool RoleMobileScanner { get; set; } = false;
    public bool RoleMaker { get; set; } = false;
    public bool RoleChecker { get; set; } = false;
    public bool RoleAdmin { get; set; } = false;
    public bool IsDeveloper { get; set; } = false;

    public int? DefaultLocationID { get; set; }

    [ForeignKey(nameof(DefaultLocationID))]
    public Location? DefaultLocation { get; set; }

    public bool IsLoggedIn { get; set; } = false;
    public Guid? SessionToken { get; set; }
    public int LoginAttempts { get; set; } = 0;
    public bool IsLocked { get; set; } = false;

    public int? CreatedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
    public int? DeletedBy { get; set; }
    public DateTime? DeletedAt { get; set; }
}
