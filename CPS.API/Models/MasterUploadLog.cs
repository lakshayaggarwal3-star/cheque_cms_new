// =============================================================================
// File        : MasterUploadLog.cs
// Project     : CPS — Cheque Processing System
// Module      : Master Upload
// Description : EF Core entity logging Excel master upload operations.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class MasterUploadLog
{
    [Key]
    public int UploadID { get; set; }

    [Required, MaxLength(50)]
    public string MasterType { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? FileName { get; set; }

    public int UploadedBy { get; set; }

    public DateTime UploadDate { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Processing";

    public int TotalRows { get; set; } = 0;
    public int SuccessRows { get; set; } = 0;
    public int ErrorRows { get; set; } = 0;
    public string? ErrorLog { get; set; }

    public DateTime CreatedAt { get; set; }
}
