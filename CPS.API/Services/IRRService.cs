// =============================================================================
// File        : IRRService.cs
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : Service interface for RR item retrieval, corrections, and batch RR completion.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface IRRService
{
    Task<List<RRItemDto>> GetRRItemsAsync(long batchId, int userId);
    Task<RRItemDto> GetRRItemAsync(long chequeItemId);
    Task<RRItemDto> SaveCorrectionAsync(long chequeItemId, SaveRRCorrectionRequest request, int userId);
    Task CompleteRRAsync(long batchId, int userId);
    Task ReleaseRRLockAsync(long batchId, int userId);
    Task HeartbeatAsync(long batchId, int userId);
}
