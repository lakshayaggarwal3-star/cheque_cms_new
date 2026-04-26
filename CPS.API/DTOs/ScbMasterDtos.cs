// =============================================================================
// File        : ScbMasterDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : SCB Master
// Description : Data Transfer Objects for SCB Master status and upload results.
// Created     : 2026-04-25
// =============================================================================

namespace CPS.API.DTOs;

public class ScbMasterStatusDto
{
    public string SectionName { get; set; } = string.Empty;
    public DateTime? LastUpdatedAt { get; set; }
    public int RecordCount { get; set; }
    public string? Version { get; set; }
    public string? UpdatedByUserName { get; set; }
}

public class ScbUploadResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public List<string> SectionsUpdated { get; set; } = new();
    public Dictionary<string, int> RowCounts { get; set; } = new();
}
