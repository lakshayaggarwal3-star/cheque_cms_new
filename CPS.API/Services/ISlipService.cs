// =============================================================================
// File        : ISlipService.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Service interface for SlipEntry creation, update, and client auto-fill.
// Created     : 2026-04-17
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface ISlipService
{
    Task<List<SlipEntryDto>> GetByBatchAsync(long batchId);
    Task<SlipEntryDto> CreateSlipEntryAsync(CreateSlipEntryRequest request, int userId);
    Task<SlipEntryDto> UpdateSlipEntryAsync(long slipEntryId, UpdateSlipEntryRequest request, int userId);
    Task<ClientAutoFillDto?> GetClientAutoFillAsync(string clientCode, int userLocationId);
    Task<List<ClientAutoFillDto>> GetClientsByLocationAsync(int userLocationId);
    Task<string> GenerateNextSlipNoAsync(long batchId);
}
