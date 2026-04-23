// =============================================================================
// File        : Enums.cs
// Project     : CPS — Cheque Processing System
// Module      : Shared
// Description : All status enums used across the application — never use raw int literals.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.Models;

public enum BatchStatus
{
    Created = 0,
    ScanningInProgress = 1,
    ScanningPending = 2,
    ScanningCompleted = 3,
    RRPending = 4,
    RRCompleted = 5
}

public enum RRState
{
    NeedsReview = 0,
    Approved = 1,
    Repaired = 2
}

public enum SlipStatus
{
    Open = 0,
    Complete = 1,
    SlipScanned = 2
}

public enum ScanStatus
{
    Pending,
    Captured,
    Failed,
    RetryPending
}
