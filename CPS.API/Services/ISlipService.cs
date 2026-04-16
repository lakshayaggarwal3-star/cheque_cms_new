// =============================================================================
// File        : ISlipService.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Service interface for slip creation, update, and client auto-fill.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface ISlipService
{
    Task<List<SlipDto>> GetByBatchAsync(long batchId);
    Task<SlipDto> CreateSlipAsync(CreateSlipRequest request, int userId);
    Task<SlipDto> UpdateSlipAsync(int slipId, UpdateSlipRequest request, int userId);
    /// <summary>Get client auto-fill data. Validates that client's CityCode matches user's Location's LocationCode, LocationName, or ClusterCode.</summary>
    Task<ClientAutoFillDto?> GetClientAutoFillAsync(string clientCode, int userLocationId);
    /// <summary>Get all clients matching the user's location (CityCode matches LocationCode, LocationName, or ClusterCode).</summary>
    Task<List<ClientAutoFillDto>> GetClientsByLocationAsync(int userLocationId);
    /// <summary>Generate next Slip No for a batch: {ScannerID}{2-digit-seq}</summary>
    Task<string> GenerateNextSlipNoAsync(long batchId);
}
