// =============================================================================
// File        : Program.cs
// Project     : CPS — Cheque Processing System
// Module      : Application Bootstrap
// Description : Configures ASP.NET Core 8 Web API with JWT auth, EF Core, Serilog, and SPA fallback.
// Created     : 2026-04-14
// =============================================================================

using System.Text;
using CPS.API.Middleware;
using CPS.API.Models;
using CPS.API.Repositories;
using CPS.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;

// ── Serilog bootstrap ────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("Logs/cps-.log", rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    // Configure limits for large XML uploads
    builder.WebHost.ConfigureKestrel(options =>
    {
        options.Limits.MaxRequestBodySize = 200 * 1024 * 1024; // 200MB
    });

    builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
    {
        options.MultipartBodyLengthLimit = 200 * 1024 * 1024; // 200MB
    });

    // EF Core
    builder.Services.AddDbContext<CpsDbContext>(opts =>
        opts.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
            sql => sql.CommandTimeout(300)));

    // JWT Bearer — reads from httpOnly cookie
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(opts =>
        {
            opts.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(builder.Configuration["Jwt:SecretKey"]!)),
                ValidateIssuer = false,
                ValidateAudience = false,
                ClockSkew = TimeSpan.Zero
            };
            opts.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    if (ctx.Request.Cookies.TryGetValue("jwt", out var token))
                        ctx.Token = token;
                    return Task.CompletedTask;
                }
            };
        });
    builder.Services.AddAuthorization();

    // Repositories
    builder.Services.AddScoped<IUserRepository, UserRepository>();
    builder.Services.AddScoped<IUserSettingRepository, UserSettingRepository>();
    builder.Services.AddScoped<IBatchRepository, BatchRepository>();
    builder.Services.AddScoped<ISlipEntryRepository, SlipEntryRepository>();
    builder.Services.AddScoped<ILocationRepository, LocationRepository>();
    builder.Services.AddScoped<IClientRepository, ClientRepository>();

    // Services
    builder.Services.AddSingleton<IImageStorageConfig, ImageStorageConfig>();
    builder.Services.AddScoped<IAuditService, AuditService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<IBatchService, BatchService>();
    builder.Services.AddScoped<IScanService, ScanService>();
    builder.Services.AddScoped<IScannerOrchestrator, ScannerOrchestrator>();
    builder.Services.AddScoped<ISlipService, SlipService>();
    builder.Services.AddScoped<IRRService, RRService>();
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<MasterUploadService>();
    builder.Services.AddScoped<IScbMasterService, ScbMasterService>();
    builder.Services.AddScoped<IMasterImportJobProcessor, MasterImportJobProcessor>();
    builder.Services.AddSingleton<IJobSignalService, JobSignalService>();
    builder.Services.AddHostedService<CPS.API.Workers.BackgroundJobWorker>();

    builder.Services.AddControllers()
        .AddJsonOptions(opts =>
            opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

    builder.Services.AddMemoryCache();

    var app = builder.Build();

    // Auto-migrate on startup + seed default developer account
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<CpsDbContext>();
        db.Database.Migrate();
        Log.Information("Database migration applied.");

        // Seed roles if table is empty
        if (!db.Roles.Any())
        {
            db.Roles.AddRange(
                new Role { RoleName = "Scanner", Description = "Create batches and operate desktop scanner." },
                new Role { RoleName = "Mobile Scanner", Description = "Create batches and scan using mobile devices." },
                new Role { RoleName = "Maker", Description = "Enter cheque and slip data (Phase 2)." },
                new Role { RoleName = "Checker", Description = "Verify Maker entries (Phase 2)." },
                new Role { RoleName = "Admin", Description = "Full system access — users, masters, settings." },
                new Role { RoleName = "Image Viewer", Description = "Restricted role for viewing cheque images." },
                new Role { RoleName = "Developer", Description = "Super-user with full system access and tools." }
            );
            db.SaveChanges();
            Log.Information("Seeded default roles catalog.");
        }

        // Seed default developer account if no users exist
        if (!db.Users.Any())
        {
            var devUser = new UserMaster
            {
                EmployeeID  = "DEV001",
                Username    = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@1234", workFactor: 12),
                Email       = "admin@cps.local",
                IsActive    = true,
                CreatedAt   = DateTime.UtcNow,
            };
            db.Users.Add(devUser);
            db.SaveChanges();

            var devRole = db.Roles.First(r => r.RoleName == "Developer");
            db.UserRoles.Add(new UserRole { UserID = devUser.UserID, RoleID = devRole.RoleID });
            db.SaveChanges();
            Log.Information("Seeded default developer account — EmployeeID: DEV001 / Password: Admin@1234");
        }
        else
        {
            // Ensure existing DEV001 has Developer role if they lost it during migration
            var devUser = db.Users.FirstOrDefault(u => u.EmployeeID == "DEV001");
            if (devUser != null)
            {
                var devRole = db.Roles.FirstOrDefault(r => r.RoleName == "Developer");
                if (devRole != null && !db.UserRoles.Any(ur => ur.UserID == devUser.UserID && ur.RoleID == devRole.RoleID))
                {
                    db.UserRoles.Add(new UserRole { UserID = devUser.UserID, RoleID = devRole.RoleID });
                    db.SaveChanges();
                    Log.Information("Restored Developer role to DEV001.");
                }
            }
        }
    }

    // Disk health log
    try
    {
        var imgConfig = app.Services.GetRequiredService<IImageStorageConfig>();
        var root = Path.GetPathRoot(imgConfig.BasePath);
        if (root != null)
        {
            var di = new DriveInfo(root);
            var gb = di.AvailableFreeSpace / (1024.0 * 1024 * 1024);
            if (gb < 1) Log.Error("CRITICAL: Only {GB:F1}GB free on image drive", gb);
            else if (gb < 5) Log.Warning("WARNING: Only {GB:F1}GB free on image drive", gb);
            else Log.Information("Image drive: {GB:F1}GB free", gb);
        }
    }
    catch (Exception ex) { Log.Warning("Disk check failed: {Msg}", ex.Message); }

    // Pipeline
    app.UseMiddleware<GlobalExceptionMiddleware>();
    app.UseMiddleware<RequestLoggingMiddleware>();

    app.UseDefaultFiles();
    
    // Enable .tflite file serving
    var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
    provider.Mappings[".tflite"] = "application/octet-stream";
    app.UseStaticFiles(new StaticFileOptions
    {
        ContentTypeProvider = provider
    });

    app.UseAuthentication();
    app.UseMiddleware<SessionValidationMiddleware>();
    app.UseAuthorization();

    app.MapControllers();
    app.MapFallbackToFile("index.html");

    Log.Information("CPS API starting — environment: {Env}", app.Environment.EnvironmentName);
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application startup failed");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
