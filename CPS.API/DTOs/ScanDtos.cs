// =============================================================================
// File        : ScanDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : DTOs for scan session management and cheque image/MICR data saving.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;
using Microsoft.AspNetCore.Http;

public class StartScanRequest
{
    public bool WithSlip { get; set; }
    public string ScanType { get; set; } = "Scan";
}

public class ScannerFeedRequest
{
    public string ScannerType { get; set; } = "Cheque";
}

public class CaptureScanRequest
{
    public bool IsSlip { get; set; }
    public int? SlipID { get; set; }
    public string ScannerType { get; set; } = "Cheque";
}

public class SaveChequeRequest
{
    public long BatchID { get; set; }
    public int SeqNo { get; set; }
    public bool IsSlip { get; set; } = false;
    public int? SlipID { get; set; }
    public string? ImageFrontPath { get; set; }
    public string? ImageBackPath { get; set; }
    public string? MICRRaw { get; set; }
    public string? ChqNo { get; set; }
    public string? MICR1 { get; set; }
    public string? MICR2 { get; set; }
    public string? MICR3 { get; set; }
    public string ScannerType { get; set; } = "Cheque";
    public string ScanType { get; set; } = "Scan";
}

public class MobileUploadScanRequest
{
    public bool IsSlip { get; set; }
    public int? SlipID { get; set; }
    public string ScannerType { get; set; } = "Mobile-Camera";
    public IFormFile? ImageFront { get; set; }
    public IFormFile? ImageBack { get; set; }
    public string? MICRRaw { get; set; }
    public string? ChqNo { get; set; }
    public string? MICR1 { get; set; }
    public string? MICR2 { get; set; }
    public string? MICR3 { get; set; }
}

public class ScanItemDto
{
    public long ScanID { get; set; }
    public long BatchID { get; set; }
    public int SeqNo { get; set; }
    public bool IsSlip { get; set; }
    public int? SlipID { get; set; }
    public string? ImageFrontPath { get; set; }
    public string? ImageBackPath { get; set; }
    public string? MICRRaw { get; set; }
    public string? ChqNo { get; set; }
    public string? MICR1 { get; set; }
    public string? MICR2 { get; set; }
    public string? MICR3 { get; set; }
    public string ScannerType { get; set; } = string.Empty;
    public string ScanStatus { get; set; } = string.Empty;
    public string? ScanError { get; set; }
    public int RetryCount { get; set; }
    public int RRState { get; set; }
}

public class ScanSessionDto
{
    public long BatchID { get; set; }
    public string BatchNo { get; set; } = string.Empty;
    public int BatchStatus { get; set; }
    public bool? WithSlip { get; set; }
    public string ScanType { get; set; } = string.Empty;
    public int? ScanLockedBy { get; set; }
    public int TotalScanned { get; set; }
    public int TotalSlips { get; set; }
    public List<ScanItemDto> Items { get; set; } = new();
}
