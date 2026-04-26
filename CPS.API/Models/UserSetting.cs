// =============================================================================
// File        : UserSetting.cs
// Project     : CPS — Cheque Processing System
// Module      : User Settings
// Description : Per-user key-value settings — individual preferences for every user.
// Created     : 2026-04-24
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class UserSetting
{
    [Key]
    public int UserSettingId { get; set; }

    public int UserID { get; set; }

    [ForeignKey(nameof(UserID))]
    public UserMaster User { get; set; } = null!;

    [Required, MaxLength(100)]
    public string SettingKey { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string SettingValue { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
