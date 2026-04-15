// =============================================================================
// File        : AppSetting.cs
// Project     : CPS — Cheque Processing System
// Module      : System / Admin
// Description : EF Core entity for runtime-configurable application settings.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class AppSetting
{
    [Key]
    public int SettingID { get; set; }

    [Required, MaxLength(100)]
    public string SettingKey { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string SettingValue { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    public int? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
