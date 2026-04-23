// =============================================================================
// File        : Role.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth / User Management
// Description : EF Core entity for generic roles (e.g. Scanner, Maker, Checker).
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class Role
{
    [Key]
    public int RoleID { get; set; }

    [Required, MaxLength(50)]
    public string RoleName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Description { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
