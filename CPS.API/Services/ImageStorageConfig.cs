// =============================================================================
// File        : ImageStorageConfig.cs
// Project     : CPS — Cheque Processing System
// Module      : Image Storage
// Description : Singleton implementing IImageStorageConfig with DB override and 60-second cache.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Services;

public class ImageStorageConfig : IImageStorageConfig
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private string? _cachedBasePath;
    private string? _cachedBankCode;
    private DateTime _cacheExpiry = DateTime.MinValue;
    private readonly object _lock = new();

    public ImageStorageConfig(IServiceScopeFactory scopeFactory, IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
    }

    public string BasePath
    {
        get
        {
            RefreshIfExpired();
            return _cachedBasePath!;
        }
    }

    public string BankCode
    {
        get
        {
            RefreshIfExpired();
            return _cachedBankCode!;
        }
    }

    public void Invalidate()
    {
        lock (_lock)
        {
            _cacheExpiry = DateTime.MinValue;
        }
    }

    private void RefreshIfExpired()
    {
        lock (_lock)
        {
            if (DateTime.UtcNow < _cacheExpiry) return;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CpsDbContext>();

            var settings = db.AppSettings
                .Where(s => s.SettingKey == "ChequeData:BasePath" || s.SettingKey == "ChequeData:BankCode")
                .ToDictionary(s => s.SettingKey, s => s.SettingValue);

            _cachedBasePath = settings.TryGetValue("ChequeData:BasePath", out var bp) && !string.IsNullOrEmpty(bp)
                ? bp
                : _configuration["ChequeData:BasePath"] ?? @"C:\ChequeData";

            _cachedBankCode = settings.TryGetValue("ChequeData:BankCode", out var bc) && !string.IsNullOrEmpty(bc)
                ? bc
                : _configuration["ChequeData:BankCode"] ?? "SCB";

            _cacheExpiry = DateTime.UtcNow.AddSeconds(60);
        }
    }
}
