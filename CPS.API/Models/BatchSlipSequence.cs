// =============================================================================
// File        : BatchSlipSequence.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Per-batch slip sequence counter used to generate traceable 7-digit SlipNo values.
// Created     : 2026-04-17
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

/// <summary>
/// One row per batch. LastSeqNo increments (with UPDLOCK) each time a slip is created.
/// SlipNo format: {BatchDailySeq:3}{ScannerIdSuffix:2}{SlipSeq:2} — always 7 digits.
/// </summary>
public class BatchSlipSequence
{
    [Key]
    public int BatchSlipSeqId { get; set; }

    public long BatchId { get; set; }

    [ForeignKey(nameof(BatchId))]
    public Batch Batch { get; set; } = null!;

    // Increments per slip created within this batch (max 99)
    public int LastSeqNo { get; set; } = 0;
}
