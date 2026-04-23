// =============================================================================
// File        : IClientRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : Repository contract for client and global client operations.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;

namespace CPS.API.Repositories;

public interface IClientRepository
{
    // ── ClientMaster ─────────────────────────────────────────────────────────
    Task<ClientMaster?> GetByCodeAsync(string cityCode);
    Task<List<ClientMaster>> GetAllAsync();
    Task<List<ClientMaster>> GetByLocationCodesAsync(string locationName, string locationCode, string clusterCode);
    Task<List<ClientMaster>> SearchAsync(string? query, int page, int pageSize, int? globalClientId = null, bool? isPriority = null, string? cityCode = null, string? clientName = null, string? rcmsCode = null);
    Task<int> GetSearchCountAsync(string? query, int? globalClientId = null, bool? isPriority = null, string? cityCode = null, string? clientName = null, string? rcmsCode = null);


    Task UpsertAsync(ClientMaster client);
    Task<ClientMaster?> GetByIdAsync(int clientId);
    Task UpdateAsync(ClientMaster client);

    // ── GlobalClient ─────────────────────────────────────────────────────────
    Task<List<GlobalClient>> GetAllGlobalClientsAsync();
    Task<GlobalClient?> GetGlobalClientByIdAsync(int globalClientId);
    Task<GlobalClient?> GetGlobalClientByCodeAsync(string globalCode);
    Task<GlobalClient> CreateGlobalClientAsync(GlobalClient globalClient);
    Task UpdateGlobalClientAsync(GlobalClient globalClient);
    Task DeleteGlobalClientAsync(int globalClientId);


    /// <summary>
    /// Links a set of ClientMaster rows to a GlobalClient and syncs IsPriority.
    /// </summary>
    Task LinkClientsToGlobalAsync(int globalClientId, List<int> clientIds);
}
