using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CPS.API.Models;
using CPS.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CPS.API.Workers
{
    public class BackgroundJobWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<BackgroundJobWorker> _logger;

        public BackgroundJobWorker(IServiceProvider serviceProvider, ILogger<BackgroundJobWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("BackgroundJobWorker starting...");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<CpsDbContext>();
                    var processor = scope.ServiceProvider.GetRequiredService<IMasterImportJobProcessor>();

                    var pendingJob = await db.Jobs
                        .Where(j => j.Status == JobStatus.Pending || j.Status == JobStatus.Processing)
                        .OrderBy(j => j.CreatedAt)
                        .FirstOrDefaultAsync(stoppingToken);

                    if (pendingJob != null)
                    {
                        _logger.LogInformation($"Starting/Resuming job {pendingJob.Id} ({pendingJob.JobType}). Status: {pendingJob.Status}");
                        await processor.ProcessJobAsync(pendingJob.Id, stoppingToken);
                        continue; // Keep checking if there are more jobs immediately
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in BackgroundJobWorker loop");
                }

                // Sleep until signaled
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var signalService = scope.ServiceProvider.GetRequiredService<IJobSignalService>();
                    await signalService.WaitForJobAsync(stoppingToken);
                }
                catch (OperationCanceledException) { }
            }

            _logger.LogInformation("BackgroundJobWorker stopping...");
        }
    }
}
