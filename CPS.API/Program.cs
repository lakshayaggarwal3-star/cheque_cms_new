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

    // EF Core
    builder.Services.AddDbContext<CpsDbContext>(opts =>
        opts.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
            sql => sql.CommandTimeout(60)));

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
    builder.Services.AddScoped<IBatchRepository, BatchRepository>();
    builder.Services.AddScoped<ISlipRepository, SlipRepository>();
    builder.Services.AddScoped<IScanRepository, ScanRepository>();
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

    builder.Services.AddControllers()
        .AddJsonOptions(opts =>
            opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

    builder.Services.AddMemoryCache();
    builder.Services.AddHttpContextAccessor();

    var app = builder.Build();

    // Auto-migrate on startup + seed default developer account
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<CpsDbContext>();
        db.Database.Migrate();
        Log.Information("Database migration applied.");

        // Seed default developer/admin account if no users exist
        if (!db.Users.Any())
        {
            db.Users.Add(new CPS.API.Models.UserMaster
            {
                EmployeeID  = "DEV001",
                Username    = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@1234", workFactor: 12),
                Email       = "admin@cps.local",
                IsActive    = true,
                RoleScanner = true,
                RoleMaker   = true,
                RoleChecker = true,
                RoleAdmin   = true,
                IsDeveloper = true,
                CreatedAt   = DateTime.UtcNow,
            });
            db.SaveChanges();
            Log.Information("Seeded default developer account — EmployeeID: DEV001 / Password: Admin@1234");
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
    app.UseStaticFiles();

    app.UseAuthentication();
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
