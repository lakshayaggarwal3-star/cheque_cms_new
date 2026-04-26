// =============================================================================
// File        : BatchItemSequence.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Tracks the global item sequence (SeqNo) for cheques within a batch.
// Created     : 2026-04-24
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

/// <summary>
/// One row per batch. LastSeqNo increments (with UPDLOCK) each time a cheque is saved.
/// This ensures unique, gapless SeqNo values for every cheque in the batch.
/// </summary>
public class BatchItemSequence
{
    [Key]
    public int BatchItemSeqId { get; set; }

    public long BatchId { get; set; }

    [ForeignKey(nameof(BatchId))]
    public Batch Batch { get; set; } = null!;

    // Increments per cheque created within this batch (1, 2, 3...)
    public int LastSeqNo { get; set; } = 0;
}
