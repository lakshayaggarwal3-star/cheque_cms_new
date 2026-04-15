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
    Task<ClientAutoFillDto?> GetClientAutoFillAsync(string clientCode);
}
