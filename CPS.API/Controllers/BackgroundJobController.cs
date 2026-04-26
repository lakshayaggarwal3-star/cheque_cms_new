using System;
using System.Linq;
using System.Threading.Tasks;
using CPS.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class BackgroundJobController : ControllerBase
    {
        private readonly CpsDbContext _db;

        public BackgroundJobController(CpsDbContext db)
        {
            _db = db;
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetJobStatus(int id)
        {
            var job = await _db.Jobs
                .Include(j => j.Errors)
                .FirstOrDefaultAsync(j => j.Id == id);
            
            if (job == null) return NotFound();

            return Ok(new
            {
                job.Id,
                job.JobType,
                job.Status,
                job.ProgressPercent,
                job.TotalRows,
                job.ProcessedRows,
                job.InsertedCount,
                job.UpdatedCount,
                job.FailedCount,
                job.ErrorMessage,
                job.CreatedAt,
                job.StartedAt,
                job.CompletedAt,
                Errors = job.Errors.Select(e => new { e.RowNumber, e.Field, e.Message }).ToList()
            });
        }

        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelJob(int id)
        {
            var job = await _db.Jobs.FindAsync(id);
            if (job == null) return NotFound();

            if (job.Status == JobStatus.Pending || job.Status == JobStatus.Processing)
            {
                job.Status = JobStatus.Cancelled;
                await _db.SaveChangesAsync();
                return Ok(new { message = "Job cancellation requested." });
            }

            return BadRequest(new { message = "Job cannot be cancelled in its current state." });
        }

        [HttpGet("user")]
        public async Task<IActionResult> GetUserJobs()
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? "0");
            var today = DateTime.UtcNow.Date;

            var jobs = await _db.Jobs
                .Where(j => j.CreatedBy == userId)
                .Where(j => j.Status != JobStatus.Completed || j.CreatedAt >= today)
                .OrderByDescending(j => j.CreatedAt)
                .Take(20)
                .ToListAsync();
            
            return Ok(jobs);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteJob(int id)
        {
            var job = await _db.Jobs.FindAsync(id);
            if (job == null) return NotFound();

            if (job.Status == JobStatus.Processing)
            {
                return BadRequest(new { message = "Cannot delete a job that is actively processing. Please cancel it first." });
            }

            _db.Jobs.Remove(job);
            await _db.SaveChangesAsync();
            return Ok(new { message = "Job deleted." });
        }
    }
}
