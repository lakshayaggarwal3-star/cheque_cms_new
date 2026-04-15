// =============================================================================
// File        : IImageStorageConfig.cs
// Project     : CPS — Cheque Processing System
// Module      : Image Storage
// Description : Singleton interface for runtime-configurable image base path with 60s cache.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.Services;

public interface IImageStorageConfig
{
    string BasePath { get; }
    string BankCode { get; }
    void Invalidate();
}
