// =============================================================================
// File        : ScannerOrchestrator.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Orchestrates real scanner agent calls and developer mock scan behavior.
// Created     : 2026-04-14
// =============================================================================

using System.Text.Json;
using CPS.API.Exceptions;

namespace CPS.API.Services;

public class ScannerOrchestrator : IScannerOrchestrator
{
    private readonly IConfiguration _config;

    public ScannerOrchestrator(IConfiguration config)
    {
        _config = config;
    }

    public Task StartFeedAsync(string scannerType, bool useMock)
    {
        if (useMock) return Task.CompletedTask;
        var endpoint = scannerType.Equals("Slip", StringComparison.OrdinalIgnoreCase)
            ? "/scanner/slip/start-feed"
            : "/scanner/cheque/start-feed";
        return PostNoContentAsync(endpoint);
    }

    public Task StopFeedAsync(string scannerType, bool useMock)
    {
        if (useMock) return Task.CompletedTask;
        var endpoint = scannerType.Equals("Slip", StringComparison.OrdinalIgnoreCase)
            ? "/scanner/slip/stop-feed"
            : "/scanner/cheque/stop-feed";
        return PostNoContentAsync(endpoint);
    }

    public async Task<ScannerCaptureResult> CaptureChequeAsync(bool useMock, string? frontFileName = null, string? backFileName = null)
    {
        if (useMock) return BuildMockCheque(frontFileName, backFileName);
        var json = await PostJsonAsync("/scanner/cheque/capture", frontFileName, backFileName);
        return ParseCapture(json, isSlip: false);
    }

    public async Task<ScannerCaptureResult> CaptureSlipAsync(bool useMock, string? frontFileName = null)
    {
        if (useMock) return BuildMockSlip(frontFileName);
        var json = await PostJsonAsync("/scanner/slip/capture", frontFileName);
        return ParseCapture(json, isSlip: true);
    }

    private async Task PostNoContentAsync(string endpoint)
    {
        using var http = CreateHttpClient();
        try
        {
            using var response = await http.PostAsync(AbsoluteUrl(endpoint), content: null);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                throw new ScannerException($"Scanner agent call failed ({response.StatusCode}): {body}");
            }
        }
        catch (Exception ex) when (ex is not ScannerException)
        {
            throw new ScannerException("Scanner agent is unavailable. Check local scanner service.", ex);
        }
    }

    private async Task<string> PostJsonAsync(string endpoint, string? frontName = null, string? backName = null)
    {
        using var http = CreateHttpClient();
        try
        {
            object? payload = null;
            if (frontName != null || backName != null)
            {
                payload = new { frontFileName = frontName, backFileName = backName };
            }
            
            var content = payload != null 
                ? new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json") 
                : null;

            using var response = await http.PostAsync(AbsoluteUrl(endpoint), content);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                throw new ScannerException($"Scanner capture failed ({response.StatusCode}): {body}");
            return body;
        }
        catch (Exception ex) when (ex is not ScannerException)
        {
            throw new ScannerException("Scanner agent capture failed. Check scanner connection.", ex);
        }
    }

    private HttpClient CreateHttpClient()
    {
        var timeoutSeconds = _config.GetValue<int?>("ScannerService:TimeoutSeconds") ?? 30;
        return new HttpClient { Timeout = TimeSpan.FromSeconds(timeoutSeconds) };
    }

    private string AbsoluteUrl(string endpoint)
    {
        var baseUrl = _config["ScannerService:BaseUrl"] ?? "http://localhost:7000";
        return $"{baseUrl.TrimEnd('/')}{endpoint}";
    }

    private ScannerCaptureResult ParseCapture(string json, bool isSlip)
    {
        if (string.IsNullOrWhiteSpace(json))
            throw new ScannerException("Scanner returned empty capture response.");

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var dataNode = root.TryGetProperty("data", out var data) ? data : root;

        var result = new ScannerCaptureResult
        {
            ImageFrontPath = ReadString(dataNode, "imageFrontPath", "frontPath", "frontImagePath", "imagePath"),
            ImageBackPath = ReadString(dataNode, "imageBackPath", "backPath", "backImagePath"),
            MICRRaw = ReadString(dataNode, "micrRaw", "micr"),
            ChqNo = ReadString(dataNode, "chqNo", "chequeNo"),
            MICR1 = ReadString(dataNode, "micr1"),
            MICR2 = ReadString(dataNode, "micr2"),
            MICR3 = ReadString(dataNode, "micr3")
        };

        if (string.IsNullOrWhiteSpace(result.ImageFrontPath))
            throw new ScannerException("Capture completed but no image path was returned by scanner agent.");

        if (isSlip)
        {
            result.ImageBackPath = null;
            result.MICRRaw = null;
            result.ChqNo = null;
            result.MICR1 = null;
            result.MICR2 = null;
            result.MICR3 = null;
        }

        return result;
    }

    private static string? ReadString(JsonElement node, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (node.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String)
                return value.GetString();
        }
        return null;
    }

    private ScannerCaptureResult BuildMockCheque(string? frontName, string? backName)
    {
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss_fff");
        var suffix = stamp[^4..];
        return new ScannerCaptureResult
        {
            ImageFrontPath = frontName != null ? $"{frontName}.jpg" : $"Scanner/{DateTime.UtcNow:yyyyMMdd}/mock/Cheque/F_{stamp}.jpg",
            ImageBackPath = backName != null ? $"{backName}.jpg" : $"Scanner/{DateTime.UtcNow:yyyyMMdd}/mock/Cheque/B_{stamp}.jpg",
            MICRRaw = $"12345678900000{suffix}",
            ChqNo = suffix.PadLeft(6, '0'),
            MICR1 = "123456789",
            MICR2 = suffix.PadLeft(6, '0'),
            MICR3 = "001"
        };
    }

    private ScannerCaptureResult BuildMockSlip(string? frontName)
    {
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss_fff");
        return new ScannerCaptureResult
        {
            ImageFrontPath = frontName != null ? $"{frontName}.jpg" : $"Scanner/{DateTime.UtcNow:yyyyMMdd}/mock/Slip/S_{stamp}.jpg"
        };
    }
}
