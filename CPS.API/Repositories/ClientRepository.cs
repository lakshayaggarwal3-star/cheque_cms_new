// =============================================================================
// File        : ClientRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : EF Core implementation of IClientRepository — includes GlobalClient CRUD.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly CpsDbContext _db;

    public ClientRepository(CpsDbContext db) => _db = db;

    // ── ClientMaster ──────────────────────────────────────────────────────────

    public async Task<ClientMaster?> GetByCodeAsync(string code) =>
        await _db.Clients
            .Include(c => c.GlobalClient)
            .FirstOrDefaultAsync(c =>
                (c.CityCode.ToUpper() == code.ToUpper() || c.RCMSCode!.ToUpper() == code.ToUpper())
                && !c.IsDeleted);

    public async Task<ClientMaster?> GetByIdAsync(int clientId) =>
        await _db.Clients
            .Include(c => c.GlobalClient)
            .FirstOrDefaultAsync(c => c.ClientID == clientId && !c.IsDeleted);

    public async Task<List<ClientMaster>> GetAllAsync() =>
        await _db.Clients
            .Include(c => c.GlobalClient)
            .AsNoTracking()
            .Where(c => !c.IsDeleted)
            .OrderBy(c => c.CityCode)
            .ToListAsync();

    public async Task<List<ClientMaster>> GetByLocationCodesAsync(
        string locationName, string locationCode, string clusterCode)
    {
        return await _db.Clients
            .Include(c => c.GlobalClient)
            .AsNoTracking()
            .Where(c => !c.IsDeleted && c.CityCode != null && (
                c.CityCode == locationName ||
                c.CityCode == locationCode ||
                c.CityCode == clusterCode))
            .OrderBy(c => c.CityCode)
            .ToListAsync();
    }

    public async Task<List<ClientMaster>> SearchAsync(string? query, int page, int pageSize, int? globalClientId = null, bool? isPriority = null, string? cityCode = null, string? clientName = null, string? rcmsCode = null)
    {
        var q = _db.Clients
            .Include(c => c.GlobalClient)
            .Where(c => !c.IsDeleted);

        if (globalClientId.HasValue)
            q = q.Where(c => c.GlobalClientID == globalClientId.Value);

        if (isPriority.HasValue)
            q = q.Where(c => c.IsPriority == isPriority.Value);

        if (!string.IsNullOrWhiteSpace(cityCode))
            q = q.Where(c => c.CityCode.ToUpper().Contains(cityCode.ToUpper()));

        if (!string.IsNullOrWhiteSpace(clientName))
            q = q.Where(c => c.ClientName.ToUpper().Contains(clientName.ToUpper()));

        if (!string.IsNullOrWhiteSpace(rcmsCode))
            q = q.Where(c => c.RCMSCode != null && c.RCMSCode.ToUpper().Contains(rcmsCode.ToUpper()));

        if (!string.IsNullOrWhiteSpace(query))
            q = q.Where(c =>
                c.CityCode.ToUpper().Contains(query.ToUpper()) ||
                c.ClientName.ToUpper().Contains(query.ToUpper()) ||
                (c.RCMSCode != null && c.RCMSCode.ToUpper().Contains(query.ToUpper())) ||
                (c.PickupPointCode != null && c.PickupPointCode.ToUpper().Contains(query.ToUpper())) ||
                (c.GlobalClient != null && c.GlobalClient.GlobalCode.ToUpper().Contains(query.ToUpper())));

        return await q.OrderBy(c => c.CityCode).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public async Task<int> GetSearchCountAsync(string? query, int? globalClientId = null, bool? isPriority = null, string? cityCode = null, string? clientName = null, string? rcmsCode = null)
    {
        var q = _db.Clients.Where(c => !c.IsDeleted);

        if (globalClientId.HasValue)
            q = q.Where(c => c.GlobalClientID == globalClientId.Value);

        if (isPriority.HasValue)
            q = q.Where(c => c.IsPriority == isPriority.Value);

        if (!string.IsNullOrWhiteSpace(cityCode))
            q = q.Where(c => c.CityCode.ToUpper().Contains(cityCode.ToUpper()));

        if (!string.IsNullOrWhiteSpace(clientName))
            q = q.Where(c => c.ClientName.ToUpper().Contains(clientName.ToUpper()));

        if (!string.IsNullOrWhiteSpace(rcmsCode))
            q = q.Where(c => c.RCMSCode != null && c.RCMSCode.ToUpper().Contains(rcmsCode.ToUpper()));

        if (!string.IsNullOrWhiteSpace(query))
            q = q.Where(c =>
                c.CityCode.ToUpper().Contains(query.ToUpper()) ||
                c.ClientName.ToUpper().Contains(query.ToUpper()) ||
                (c.RCMSCode != null && c.RCMSCode.ToUpper().Contains(query.ToUpper())));
        return await q.CountAsync();
    }


    public async Task UpsertAsync(ClientMaster client)
    {
        _db.Clients.Add(client);
        await _db.SaveChangesAsync();
    }

    public async Task UpdateAsync(ClientMaster client)
    {
        _db.Clients.Update(client);
        await _db.SaveChangesAsync();
    }

    // ── GlobalClient ──────────────────────────────────────────────────────────

    public async Task<List<GlobalClient>> GetAllGlobalClientsAsync() =>
        await _db.GlobalClients
            .AsNoTracking()
            .Include(g => g.Clients.Where(c => !c.IsDeleted))
            .OrderBy(g => g.GlobalCode)
            .ToListAsync();

    public async Task<GlobalClient?> GetGlobalClientByIdAsync(int globalClientId) =>
        await _db.GlobalClients
            .Include(g => g.Clients.Where(c => !c.IsDeleted))
            .FirstOrDefaultAsync(g => g.GlobalClientID == globalClientId);

    public async Task<GlobalClient?> GetGlobalClientByCodeAsync(string globalCode) =>
        await _db.GlobalClients
            .FirstOrDefaultAsync(g => g.GlobalCode.ToUpper() == globalCode.ToUpper());

    public async Task<GlobalClient> CreateGlobalClientAsync(GlobalClient globalClient)
    {
        _db.GlobalClients.Add(globalClient);
        await _db.SaveChangesAsync();
        return globalClient;
    }

    public async Task UpdateGlobalClientAsync(GlobalClient globalClient)
    {
        var existing = await _db.GlobalClients
            .Include(g => g.Clients)
            .FirstOrDefaultAsync(g => g.GlobalClientID == globalClient.GlobalClientID);

        if (existing == null) return;

        bool priorityChanged = existing.IsPriority != globalClient.IsPriority;
        
        existing.GlobalName = globalClient.GlobalName;
        existing.IsPriority = globalClient.IsPriority;
        existing.IsActive = globalClient.IsActive;
        existing.UpdatedAt = DateTime.UtcNow;

        if (priorityChanged)
        {
            foreach (var client in existing.Clients)
            {
                client.IsPriority = existing.IsPriority;
                client.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();
    }


    public async Task DeleteGlobalClientAsync(int globalClientId)
    {
        var globalClient = await _db.GlobalClients
            .Include(g => g.Clients)
            .FirstOrDefaultAsync(g => g.GlobalClientID == globalClientId);

        if (globalClient != null)
        {
            foreach (var client in globalClient.Clients)
            {
                client.GlobalClientID = null;
                client.IsPriority = false;
            }
            _db.GlobalClients.Remove(globalClient);
            await _db.SaveChangesAsync();
        }
    }


    /// <summary>
    /// Links specified ClientMaster rows to a GlobalClient and syncs their IsPriority flag.
    /// Previous links (if any) for those clients are replaced.
    /// </summary>
    public async Task LinkClientsToGlobalAsync(int globalClientId, List<int> clientIds)
    {
        var globalClient = await _db.GlobalClients.FindAsync(globalClientId)
            ?? throw new InvalidOperationException($"GlobalClient {globalClientId} not found.");

        var clients = await _db.Clients
            .Where(c => clientIds.Contains(c.ClientID) && !c.IsDeleted)
            .ToListAsync();

        foreach (var client in clients)
        {
            client.GlobalClientID = globalClientId;
            client.IsPriority = globalClient.IsPriority;
            client.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }
}
