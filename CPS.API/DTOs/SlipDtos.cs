// =============================================================================
// File        : SlipDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : DTOs for SlipEntry creation, update, listing, and resume state.
// Created     : 2026-04-17
// =============================================================================

namespace CPS.API.DTOs;

public class CreateSlipEntryRequest
{
    public long BatchId { get; set; }
    public string? ClientCode { get; set; }
    public string? ClientName { get; set; }
    public string? DepositSlipNo { get; set; }
    public string? PickupPoint { get; set; }
    public int TotalInstruments { get; set; }
    public decimal SlipAmount { get; set; }
    public string? Remarks { get; set; }
}

public class UpdateSlipEntryRequest
{
    public string? ClientCode { get; set; }
    public string? ClientName { get; set; }
    public string? DepositSlipNo { get; set; }
    public string? PickupPoint { get; set; }
    public int TotalInstruments { get; set; }
    public decimal SlipAmount { get; set; }
    public string? Remarks { get; set; }
    public byte[] RowVersion { get; set; } = null!;
}

public class SlipEntryDto
{
    public long SlipEntryId { get; set; }
    public long BatchId { get; set; }
    public string SlipNo { get; set; } = string.Empty;
    public string? ClientCode { get; set; }
    public string? ClientName { get; set; }
    public string? DepositSlipNo { get; set; }
    public string? PickupPoint { get; set; }
    public int TotalInstruments { get; set; }
    public decimal SlipAmount { get; set; }
    public string? Remarks { get; set; }
    public int SlipStatus { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public byte[] RowVersion { get; set; } = null!;

    // Nested scan images and cheques for grouped display
    public List<SlipScanDto> SlipScans { get; set; } = new();
    public List<ChequeItemDto> Cheques { get; set; } = new();
}

public class SlipScanDto
{
    public long SlipScanId { get; set; }
    public long SlipEntryId { get; set; }
    public int ScanOrder { get; set; }
    public string ScanStatus { get; set; } = string.Empty;
    public string? ScanError { get; set; }
    public int RetryCount { get; set; }
    public string? ImageBaseName { get; set; }
    public string? FileExtension { get; set; }
    public string? ImageHash { get; set; }
}

public class ChequeItemDto
{
    public long ChequeItemId { get; set; }
    public long SlipEntryId { get; set; }
    public long BatchId { get; set; }
    public int SeqNo { get; set; }
    public int ChqSeq { get; set; }
    public string? ChqNo { get; set; }
    public string? ScanChqNo { get; set; }
    public string? RRChqNo { get; set; }
    public string? MICRRaw { get; set; }
    public string? ScanMICRRaw { get; set; }

    // Final / Effective MICR
    public string? MICR1 { get; set; }
    public string? MICR2 { get; set; }
    public string? MICR3 { get; set; }

    // Scanner MICR (raw from hardware)
    public string? ScanMICR1 { get; set; }
    public string? ScanMICR2 { get; set; }
    public string? ScanMICR3 { get; set; }

    // RR MICR (after repair)
    public string? RRMICR1 { get; set; }
    public string? RRMICR2 { get; set; }
    public string? RRMICR3 { get; set; }
    public string? RRNotes { get; set; }
    public int RRState { get; set; }
    public string ScanStatus { get; set; } = string.Empty;
    public string? ScanError { get; set; }
    public int RetryCount { get; set; }
    public string? ImageBaseName { get; set; }
    public string? FileExtension { get; set; }
    public string? ImageHash { get; set; }

    public DateTime? ScannerStartedAt { get; set; }
    public int? ScannerCompletedBy { get; set; }
    public DateTime? ScannerCompletedAt { get; set; }
    public DateTime? RRStartedAt { get; set; }
    public int? RRCompletedBy { get; set; }
    public DateTime? RRCompletedAt { get; set; }
}

// Resume state — tells frontend exactly where the user left off
public class ScanResumeStateDto
{
    // Which slip entry is currently active (incomplete or just created)
    public long? ActiveSlipEntryId { get; set; }
    public string? ActiveSlipNo { get; set; }

    // What step was in progress when the session broke
    // Values: "SlipEntry" | "SlipScan" | "ChequeScan" | null (fresh start)
    public string? ResumeStep { get; set; }

    // Next scan order for the active slip's slip images
    public int NextSlipScanOrder { get; set; } = 1;

    // Next cheque seq within the active slip
    public int NextChqSeq { get; set; } = 1;
}
