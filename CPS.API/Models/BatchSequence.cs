// =============================================================================
// File        : BatchSequence.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : EF Core entity for daily batch sequence number tracking per location.
// Created     : 2026-04-14
// =============================================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CPS.API.Models;

public class BatchSequence
{
    [Key]
    public int SeqID { get; set; }

    public DateOnly BatchDate { get; set; }

    public int LocationID { get; set; }

    [ForeignKey(nameof(LocationID))]
    public Location Location { get; set; } = null!;

    public int LastSeqNo { get; set; } = 0;
}
