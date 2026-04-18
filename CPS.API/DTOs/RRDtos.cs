// =============================================================================
// File        : RRDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : DTOs for RR cheque item listing, correction saving, and completion.
// Created     : 2026-04-17
// =============================================================================

namespace CPS.API.DTOs;

public class RRItemDto
{
    public long ChequeItemId { get; set; }
    public long BatchId { get; set; }
    public int SlipEntryId { get; set; }
    public int SeqNo { get; set; }
    public int ChqSeq { get; set; }
    public string? ImageFrontPath { get; set; }
    public string? ImageBackPath { get; set; }
    public string? MICRRaw { get; set; }
    public string? ChqNo { get; set; }

    // Scanner MICR (read-only — raw from hardware)
    public string? ScanMICR1 { get; set; }
    public string? ScanMICR2 { get; set; }
    public string? ScanMICR3 { get; set; }
    public decimal? ScanAmount { get; set; }

    // RR MICR (editable during repair)
    public string? RRMICR1 { get; set; }
    public string? RRMICR2 { get; set; }
    public string? RRMICR3 { get; set; }
    public decimal? RRAmount { get; set; }
    public string? RRNotes { get; set; }

    public int RRState { get; set; }
    public string? RRStateLabel { get; set; }

    // Slip context for display
    public string? SlipNo { get; set; }
    public string? ClientName { get; set; }
    public decimal? SlipAmount { get; set; }
    public int? TotalInstruments { get; set; }

    public byte[] RowVersion { get; set; } = null!;
}

public class SaveRRCorrectionRequest
{
    public string? ChqNo { get; set; }
    // Set RR MICR fields during repair (scanner MICR is never modified)
    public string? RRMICR1 { get; set; }
    public string? RRMICR2 { get; set; }
    public string? RRMICR3 { get; set; }
    public decimal? RRAmount { get; set; }
    public string? RRNotes { get; set; }
    public bool Approve { get; set; } = false;
    public byte[] RowVersion { get; set; } = null!;
}
