// =============================================================================
// File        : MasterUploadDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : DTOs for masters verification, bulk apply, and upload results.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class UploadResultDto
{
    public int TotalRows { get; set; }
    public int SuccessRows { get; set; }
    public int ErrorRows { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<UploadErrorDto> Errors { get; set; } = new();
}

public class UploadErrorDto
{
    public int RowNumber { get; set; }
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? RowData { get; set; }
}

public class MasterUploadLogDto
{
    public int UploadID { get; set; }
    public string MasterType { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string UploadedBy { get; set; } = string.Empty;
    public string UploadDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int SuccessRows { get; set; }
    public int ErrorRows { get; set; }
}

public class MasterDataRowDto
{
    public Dictionary<string, string?> Values { get; set; } = new();
}

public class MasterPreviewDto
{
    public string MasterType { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int ErrorRows { get; set; }
    public List<UploadErrorDto> Errors { get; set; } = new();
    public List<MasterDataRowDto> Rows { get; set; } = new();
}

public class MasterApplyRequest
{
    public List<MasterDataRowDto> Rows { get; set; } = new();
}
