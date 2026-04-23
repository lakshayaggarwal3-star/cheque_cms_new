// =============================================================================
// File        : ClientDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : DTOs for client auto-fill, CRUD, and global client operations.
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

    // Global client fields
    public int? GlobalClientID { get; set; }
    public string? GlobalCode { get; set; }
    public string? GlobalName { get; set; }
    public bool? IsPriority { get; set; }

}

public class ClientAutoFillDto
{
    public string CityCode { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string? PickupPointCode { get; set; }
    public string? PickupPointDesc { get; set; }
    public string? RCMSCode { get; set; }
    public string? Status { get; set; }

    // Global client fields — needed in slip entry to enforce priority batches
    public int? GlobalClientID { get; set; }
    public string? GlobalCode { get; set; }
    public bool IsPriority { get; set; }
}

// ── Global Client DTOs ────────────────────────────────────────────────────────

public class GlobalClientDto
{
    public int GlobalClientID { get; set; }
    public string GlobalCode { get; set; } = string.Empty;
    public string GlobalName { get; set; } = string.Empty;
    public bool IsPriority { get; set; }
    public bool IsActive { get; set; }
    public int LinkedClientCount { get; set; }
}

public class CreateGlobalClientRequest
{
    public string GlobalCode { get; set; } = string.Empty;
    public string GlobalName { get; set; } = string.Empty;
    public bool IsPriority { get; set; }
}

public class UpdateGlobalClientRequest
{
    public string GlobalName { get; set; } = string.Empty;
    public bool IsPriority { get; set; }
    public bool IsActive { get; set; }
}

public class LinkGlobalClientRequest
{
    /// <summary>ClientID rows to link to this GlobalClient.</summary>
    public List<int> ClientIDs { get; set; } = new();
    public int GlobalClientID { get; set; }
}

