// =============================================================================
// File        : SlipSequence.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : EF Core entity for daily slip sequence number tracking per scanner per location.
// Created     : 2026-04-16
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

/// <summary>
/// Tracks daily slip sequence numbers per scanner per location.
/// SlipNo format: {ScannerID}{2-digit-seq-zero-padded} (e.g., 38501, 38502)
/// One record per (ScanDate, LocationID, ScannerMappingID) combination.
/// </summary>
public class SlipSequence
{
    [Key]
    public int SeqID { get; set; }

    public DateOnly SlipDate { get; set; }

    public int LocationID { get; set; }

    [ForeignKey(nameof(LocationID))]
    public Location Location { get; set; } = null!;

    public int? ScannerMappingID { get; set; }

    [ForeignKey(nameof(ScannerMappingID))]
    public LocationScanner? Scanner { get; set; }

    /// <summary>Last sequence number generated (0-99). Next slip will use LastSeqNo + 1.</summary>
    public int LastSeqNo { get; set; } = 0;
}
