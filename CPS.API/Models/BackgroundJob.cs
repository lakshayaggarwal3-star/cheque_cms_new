// =============================================================================
// File        : BackgroundJob.cs
// Project     : CPS — Cheque Processing System
// Module      : Infrastructure / Jobs
// Description : Model for tracking long-running background tasks.
// Created     : 2026-04-25
// =============================================================================

using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace CPS.API.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum JobStatus
    {
        Pending,
        Processing,
        Completed,
        Failed,
        Cancelled
    }

    public class BackgroundJob
    {
        [Key]
        public int Id { get; set; }

        [Required, MaxLength(100)]
        public string JobType { get; set; } = string.Empty; // e.g., "Location", "Client"

        [Required, MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        public JobStatus Status { get; set; } = JobStatus.Pending;

        public int ProgressPercent { get; set; } = 0;
        
        public int TotalRows { get; set; }
        public int ProcessedRows { get; set; }
        public int InsertedCount { get; set; }
        public int UpdatedCount { get; set; }
        public int FailedCount { get; set; }

        public string? ErrorFilePath { get; set; }
        public string? ErrorMessage { get; set; }

        // Stores a JSON array of log messages: [{ time: "...", msg: "..." }]
        public string? LogsJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }

        public int CreatedBy { get; set; }
        
        [ForeignKey("CreatedBy")]
        public virtual UserMaster? Creator { get; set; }

        public virtual ICollection<JobError> Errors { get; set; } = new List<JobError>();
    }

    public class JobError
    {
        [Key]
        public int Id { get; set; }
        public int JobId { get; set; }
        public int RowNumber { get; set; }
        public string? Field { get; set; }
        public string? Message { get; set; }
        public string? RawData { get; set; } // JSON of the row data
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("JobId")]
        public virtual BackgroundJob? Job { get; set; }
    }
}
