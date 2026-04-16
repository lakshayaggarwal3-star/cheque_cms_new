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
        // Always insert new record — multiple clients with same code/city are allowed
        _db.Clients.Add(client);
        await _db.SaveChangesAsync();
    }
}
