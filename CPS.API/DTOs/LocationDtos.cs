// =============================================================================
// File        : LocationDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Location Master
// Description : DTOs for location listing and scanner information.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class LocationDto
{
    public int LocationID { get; set; }
    public string LocationName { get; set; } = string.Empty;
    public string LocationCode { get; set; } = string.Empty;
    public string? State { get; set; }
    public string? Grid { get; set; }
    public string? ClusterCode { get; set; }
    public string? Zone { get; set; }
    public string? LocType { get; set; }
    public string? PIFPrefix { get; set; }
    public bool IsActive { get; set; }
    public List<ScannerDto> Scanners { get; set; } = new();
    public LocationFinanceDto? Finance { get; set; }
}

public class ScannerDto
{
    public int ScannerMappingID { get; set; }
    public string ScannerID { get; set; } = string.Empty;
    public string? ScannerModel { get; set; }
    public string? ScannerType { get; set; }
    public bool IsActive { get; set; }
}

public class LocationFinanceDto
{
    public string? BOFD { get; set; }
    public string? PreTrun { get; set; }
    public string? DepositAccount { get; set; }
    public string? IFSC { get; set; }
}

public class CreateLocationRequest
{
    public string LocationName { get; set; } = string.Empty;
    public string LocationCode { get; set; } = string.Empty;
    public string? State { get; set; }
    public string? Grid { get; set; }
    public string? ClusterCode { get; set; }
    public string? Zone { get; set; }
    public string? LocType { get; set; }
    public string? PIFPrefix { get; set; }
}
