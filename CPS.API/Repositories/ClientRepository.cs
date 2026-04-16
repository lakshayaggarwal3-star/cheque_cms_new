// =============================================================================
// File        : ClientRepository.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : EF Core implementation of IClientRepository.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Models;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly CpsDbContext _db;

    public ClientRepository(CpsDbContext db) => _db = db;

    public async Task<ClientMaster?> GetByCodeAsync(string code) =>
        await _db.Clients.FirstOrDefaultAsync(c =>
            (c.CityCode.ToUpper() == code.ToUpper() || c.RCMSCode.ToUpper() == code.ToUpper()) && !c.IsDeleted);

    public async Task<List<ClientMaster>> GetAllAsync() =>
        await _db.Clients
            .Where(c => !c.IsDeleted)
            .OrderBy(c => c.CityCode)
            .ToListAsync();

    public async Task<List<ClientMaster>> SearchAsync(string? query, int page, int pageSize)
    {
        var q = _db.Clients.Where(c => !c.IsDeleted);
        if (!string.IsNullOrWhiteSpace(query))
            q = q.Where(c => c.CityCode.ToUpper().Contains(query.ToUpper()) || c.ClientName.ToUpper().Contains(query.ToUpper()));
        return await q.OrderBy(c => c.CityCode).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    }

    public async Task<int> GetSearchCountAsync(string? query)
    {
        var q = _db.Clients.Where(c => !c.IsDeleted);
        if (!string.IsNullOrWhiteSpace(query))
            q = q.Where(c => c.CityCode.ToUpper().Contains(query.ToUpper()) || c.ClientName.ToUpper().Contains(query.ToUpper()));
        return await q.CountAsync();
    }

    public async Task UpsertAsync(ClientMaster client)
    {
        // RCMSCode is the unique identifier for a client
        var existing = await _db.Clients.FirstOrDefaultAsync(c => c.RCMSCode == client.RCMSCode && !c.IsDeleted);
        if (existing == null)
        {
            _db.Clients.Add(client);
        }
        else
        {
            existing.CityCode = client.CityCode;
            existing.ClientName = client.ClientName;
            existing.Address1 = client.Address1;
            existing.Address2 = client.Address2;
            existing.Address3 = client.Address3;
            existing.Address4 = client.Address4;
            existing.Address5 = client.Address5;
            existing.PickupPointCode = client.PickupPointCode;
            existing.PickupPointDesc = client.PickupPointDesc;
            existing.Status = client.Status;
            existing.StatusDate = client.StatusDate;
            existing.UpdatedBy = client.UpdatedBy;
            existing.UpdatedAt = client.UpdatedAt;
        }
        await _db.SaveChangesAsync();
    }
}
