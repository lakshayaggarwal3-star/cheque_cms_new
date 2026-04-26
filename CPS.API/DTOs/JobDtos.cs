using System;
using System.Collections.Generic;

namespace CPS.API.DTOs
{
    public class JobStartDto
    {
        public int JobId { get; set; }
        public string Status { get; set; } = "Pending";
        public string Message { get; set; } = string.Empty;
    }

    public class JobStatusDto
    {
        public int JobId { get; set; }
        public string Status { get; set; } = string.Empty;
        public int ProgressPercent { get; set; }
        public int TotalRows { get; set; }
        public int ProcessedRows { get; set; }
        public int InsertedCount { get; set; }
        public int UpdatedCount { get; set; }
        public int FailedCount { get; set; }
        public string? ErrorMessage { get; set; }
        public List<JobErrorDto> Errors { get; set; } = new();
    }

    public class JobErrorDto
    {
        public int RowNumber { get; set; }
        public string? Field { get; set; }
        public string? Message { get; set; }
    }
}
