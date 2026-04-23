// =============================================================================
// File        : UserRole.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth / User Management
// Description : EF Core entity mapping Users to Roles.
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class UserRole
{
    [Key]
    public int UserRoleID { get; set; }

    [Required]
    public int UserID { get; set; }

    [Required]
    public int RoleID { get; set; }

    [ForeignKey(nameof(UserID))]
    public UserMaster User { get; set; } = null!;

    [ForeignKey(nameof(RoleID))]
    public Role Role { get; set; } = null!;
}
