// =============================================================================
// File        : RRDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : DTOs for RR item listing, correction saving, and completion.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class RRItemDto
{
    public long ScanID { get; set; }
    public long BatchID { get; set; }
    public int SeqNo { get; set; }
    public bool IsSlip { get; set; }
    public string? ImageFrontPath { get; set; }
    public string? ImageBackPath { get; set; }
    public string? MICRRaw { get; set; }
    public string? ChqNo { get; set; }
    public string? MICR1 { get; set; }
    public string? MICR2 { get; set; }
    public string? MICR3 { get; set; }
    public int RRState { get; set; }
    public string? RRStateLabel { get; set; }
    public int? SlipID { get; set; }
    public string? SlipNo { get; set; }
    public string? ClientName { get; set; }
    public decimal? SlipAmount { get; set; }
    public int? TotalInstruments { get; set; }
    public byte[] RowVersion { get; set; } = null!;
}

public class SaveRRCorrectionRequest
{
    public string? ChqNo { get; set; }
    public string? MICR1 { get; set; }
    public string? MICR2 { get; set; }
    public string? MICR3 { get; set; }
    public bool Approve { get; set; } = false;
    public byte[] RowVersion { get; set; } = null!;
}
