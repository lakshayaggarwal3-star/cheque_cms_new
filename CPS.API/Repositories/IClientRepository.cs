// =============================================================================
// File        : IClientRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : Repository interface for client master DB operations.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface IClientRepository
{
    Task<ClientMaster?> GetByCodeAsync(string cityCode);
    Task<List<ClientMaster>> GetAllAsync();
    Task<List<ClientMaster>> GetByLocationCodesAsync(string locationName, string locationCode, string clusterCode);
    Task<List<ClientMaster>> SearchAsync(string? query, int page, int pageSize);
    Task<int> GetSearchCountAsync(string? query);
    Task UpsertAsync(ClientMaster client);
}
