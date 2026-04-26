// =============================================================================
// File        : IScannerOrchestrator.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Scanner orchestration contract for feed control and cheque/slip capture.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.Services;

public class ScannerCaptureResult
{
    public string? ImageFrontPath { get; set; }
    public string? ImageBackPath { get; set; }
    public string? MICRRaw { get; set; }
    public string? ChqNo { get; set; }
    public string? MICR1 { get; set; }
    public string? MICR2 { get; set; }
    public string? MICR3 { get; set; }
}

public interface IScannerOrchestrator
{
    Task StartFeedAsync(string scannerType, bool useMock);
    Task StopFeedAsync(string scannerType, bool useMock);
    Task<ScannerCaptureResult> CaptureChequeAsync(bool useMock, string? frontFileName = null, string? backFileName = null);
    Task<ScannerCaptureResult> CaptureSlipAsync(bool useMock, string? frontFileName = null);
}
