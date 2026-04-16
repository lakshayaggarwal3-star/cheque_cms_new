// =============================================================================
// File        : SlipDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : DTOs for slip creation, update, and listing.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class CreateSlipRequest
{
    public long BatchID { get; set; }
    public string? SlipNo { get; set; } // Auto-generated if not provided (format: {ScannerID}{2-digit-seq})
    public string? ClientCode { get; set; }
    public string? ClientName { get; set; }
    public string? DepositSlipNo { get; set; }
    public string? PickupPoint { get; set; }
    public int TotalInstruments { get; set; }
    public decimal SlipAmount { get; set; }
    public string? Remarks { get; set; }
}

public class UpdateSlipRequest
{
    public string SlipNo { get; set; } = string.Empty;
    public string? ClientCode { get; set; }
    public string? ClientName { get; set; }
    public string? DepositSlipNo { get; set; }
    public string? PickupPoint { get; set; }
    public int TotalInstruments { get; set; }
    public decimal SlipAmount { get; set; }
    public string? Remarks { get; set; }
    public byte[] RowVersion { get; set; } = null!;
}

public class SlipDto
{
    public int SlipID { get; set; }
    public long BatchID { get; set; }
    public string SlipNo { get; set; } = string.Empty;
    public string? ClientCode { get; set; }
    public string? ClientName { get; set; }
    public string? DepositSlipNo { get; set; }
    public string? PickupPoint { get; set; }
    public int TotalInstruments { get; set; }
    public decimal SlipAmount { get; set; }
    public string? Remarks { get; set; }
    public int SlipStatus { get; set; }
    public int LinkedCheques { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public byte[] RowVersion { get; set; } = null!;
}
