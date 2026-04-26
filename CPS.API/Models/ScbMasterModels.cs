// =============================================================================
// File        : ScbMasterModels.cs
// Project     : CPS — Cheque Processing System
// Module      : SCB Master (CHM)
// Description : Models for Clearing House Master data (Banks, Branches, Reasons).
// Created     : 2026-04-25
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class ScbMasterStatus
{
    [Key]
    public string SectionName { get; set; } = string.Empty; // e.g., "Bank", "Branch"
    public DateTime LastUpdatedAt { get; set; }
    public int RecordCount { get; set; }
    public string? Version { get; set; }
    public int UpdatedBy { get; set; }
}

public class ScbBank
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.None)]
    public string BankRoutingNo { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? StreetAddress { get; set; }
    public string? City { get; set; }
    public string? StateProvince { get; set; }
    public string? PostalZipCode { get; set; }
    public string? Country { get; set; }
    public string? ClearingStatusCode { get; set; }
    public string? Note { get; set; }
    public string? ServiceBranchRoutingNo { get; set; }
    public string? DesignatedBranchRoutingNo { get; set; }
    public bool CbsEnabled { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ScbBranch
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.None)]
    public string BranchRoutingNo { get; set; } = string.Empty;
    public string BankRoutingNo { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? StreetAddress { get; set; }
    public string? City { get; set; }
    public string? StateProvince { get; set; }
    public string? PostalZipCode { get; set; }
    public string? Country { get; set; }
    public string? BranchNumber { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ScbReturnReason
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.None)]
    public string ReturnReasonCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class ScbSessionDefinition
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.None)]
    public string SessionNbr { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? OpenReceivingTime { get; set; }
    public string? CloseReceivingTime { get; set; }
    public string? CalendarCode { get; set; }
    public string? CurrencyCode { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ScbCityMaster
{
    [Key]
    public int Id { get; set; }
    public string CityCode { get; set; } = string.Empty;
    public string CityName { get; set; } = string.Empty;
    public string? ClearingType { get; set; }
}

public class ScbTranslationRule
{
    [Key]
    public int Id { get; set; }
    public string PayorBankRoutingNo { get; set; } = string.Empty;
    public string LogicalRoutingNo { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
}
