// =============================================================================
// File        : ClientDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : DTOs for client auto-fill and CRUD operations.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class ClientDto
{
    public int ClientID { get; set; }
    public string CityCode { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string? Address1 { get; set; }
    public string? Address2 { get; set; }
    public string? PickupPointCode { get; set; }
    public string? PickupPointDesc { get; set; }
    public string? RCMSCode { get; set; }
    public string? Status { get; set; }
}

public class ClientAutoFillDto
{
    public string CityCode { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string? PickupPointCode { get; set; }
    public string? PickupPointDesc { get; set; }
    public string? RCMSCode { get; set; }
    public string? Status { get; set; }
}
