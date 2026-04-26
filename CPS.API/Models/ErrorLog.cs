// =============================================================================
// File        : ErrorLog.cs
// Project     : CPS — Cheque Processing System
// Module      : Logging
// Description : EF Core entity for system error and exception logs.
// =============================================================================

using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class ErrorLog
{
    [Key]
    public long ErrorID { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [MaxLength(255)]
    public string? Endpoint { get; set; }

    [Required]
    public string ErrorMessage { get; set; } = string.Empty;

    public string? StackTrace { get; set; }

    public int? UserID { get; set; }

    [MaxLength(45)]
    public string? IPAddress { get; set; }
}
