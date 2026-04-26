// =============================================================================
// File        : ScanDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : DTOs for scan session management, slip scan, and cheque capture.
// Created     : 2026-04-17
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

// Capture a slip item image for a specific SlipEntry
public class CaptureSlipItemRequest
{
    public long SlipEntryId { get; set; }
    public int ScanOrder { get; set; } = 1;
    public string ScannerType { get; set; } = "Document";
}

// Capture a cheque for a specific SlipEntry
public class CaptureChequeRequest
{
    public long SlipEntryId { get; set; }
    public string ScannerType { get; set; } = "Cheque";
}

public class SaveSlipItemRequest
{
    public long BatchId { get; set; }
    public long SlipEntryId { get; set; }
    public int ScanOrder { get; set; } = 1;
    public string? ImagePath { get; set; }
    public string ScannerType { get; set; } = "Document";
}

public class SaveChequeItemRequest
{
    public long BatchId { get; set; }
    public long SlipEntryId { get; set; }
    public int ChqSeq { get; set; }
    public int SeqNo { get; set; }
    public string? ChqNo { get; set; }
    public string? ScanChqNo { get; set; }
    public string? RRChqNo { get; set; }
    public string? MICRRaw { get; set; }
    public string? ScanMICRRaw { get; set; }
    public string? ScanMICR1 { get; set; }
    public string? ScanMICR2 { get; set; }
    public string? ScanMICR3 { get; set; }
    public string? FrontImagePath { get; set; }
    public string? BackImagePath { get; set; }
    public string? FrontImageTiffPath { get; set; }
    public string? BackImageTiffPath { get; set; }
    public string ScannerType { get; set; } = "Cheque";
    public string ScanType { get; set; } = "Scan";
}

public class MobileUploadSlipItemRequest
{
    public long SlipEntryId { get; set; }
    public int ScanOrder { get; set; } = 1;
    public IFormFile? Image { get; set; }
    public string ScannerType { get; set; } = "Mobile-Camera";
}

public class BulkSlipItemUploadRequest
{
    public long SlipEntryId { get; set; }
    public List<IFormFile> Images { get; set; } = new();
    public string ScannerType { get; set; } = "Direct-Upload";
}


public class MobileUploadChequeRequest
{
    public long SlipEntryId { get; set; }
    public int ChqSeq { get; set; }
    public IFormFile? ImageFront { get; set; }
    public IFormFile? ImageBack { get; set; }
    public IFormFile? ImageFrontTiff { get; set; }
    public IFormFile? ImageBackTiff { get; set; }
    public string? ChqNo { get; set; }
    public string? ScanChqNo { get; set; }
    public string? RRChqNo { get; set; }
    public string? MICRRaw { get; set; }
    public string? ScanMICRRaw { get; set; }
    public string? ScanMICR1 { get; set; }
    public string? ScanMICR2 { get; set; }
    public string? ScanMICR3 { get; set; }
    public string ScannerType { get; set; } = "Mobile-Camera";
}

public class ScanSessionDto
{
    public long BatchId { get; set; }
    public string BatchNo { get; set; } = string.Empty;
    public int BatchStatus { get; set; }
    public bool? WithSlip { get; set; }
    public string ScanType { get; set; } = string.Empty;
    public int? ScanLockedBy { get; set; }
    public int TotalCheques { get; set; }
    public int TotalSlipEntries { get; set; }
    public decimal TotalAmount { get; set; }

    // All slip entries with their nested scans and cheques (grouped display)
    public List<SlipEntryDto> SlipGroups { get; set; } = new();

    // Global slip scans for non-slip batches
    public List<SlipItemDto> SlipItems { get; set; } = new();

    // Where to resume if session was interrupted
    public ScanResumeStateDto ResumeState { get; set; } = new();
}
