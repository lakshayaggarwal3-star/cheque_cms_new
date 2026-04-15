// =============================================================================
// File        : BatchDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : DTOs for batch creation, listing, and dashboard.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class CreateBatchRequest
{
    public int LocationID { get; set; }
    public int ScannerMappingID { get; set; }
    public string? PickupPointCode { get; set; }
    public DateOnly BatchDate { get; set; }
    public string ClearingType { get; set; } = "01";
    public bool IsPDC { get; set; } = false;
    public DateOnly? PDCDate { get; set; }
    public int TotalSlips { get; set; }
    public decimal TotalAmount { get; set; }

    // Operator types these from the physical PIF paper form — must be identical
    public string? SummRefNo { get; set; }
    public string? PIF { get; set; }
}

public class BatchDto
{
    public long BatchID { get; set; }
    // Internal system number — legacy desktop style sequence format (e.g. 00001).
    public string BatchNo { get; set; } = string.Empty;
    // Operator-entered fields — stored separately, both must match at creation time
    public string? SummRefNo { get; set; }
    public string? PIF { get; set; }
    public int LocationID { get; set; }
    public string LocationName { get; set; } = string.Empty;
    public string LocationCode { get; set; } = string.Empty;
    public int? ScannerMappingID { get; set; }
    public string? ScannerID { get; set; }
    public string? PickupPointCode { get; set; }
    public string BatchDate { get; set; } = string.Empty;
    public string ClearingType { get; set; } = string.Empty;
    public bool IsPDC { get; set; }
    public string? PDCDate { get; set; }
    public int TotalSlips { get; set; }
    public decimal TotalAmount { get; set; }
    public string ScanType { get; set; } = string.Empty;
    public bool? WithSlip { get; set; }
    public int BatchStatus { get; set; }
    public string BatchStatusLabel { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

public class DashboardSummary
{
    public int TotalBatchesToday { get; set; }
    public int ScanningPending { get; set; }
    public int RRPending { get; set; }
    public int Completed { get; set; }
}

public class UpdateBatchStatusRequest
{
    public int NewStatus { get; set; }
    public string? Reason { get; set; }
}
