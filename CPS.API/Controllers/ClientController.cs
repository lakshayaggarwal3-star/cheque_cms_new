// =============================================================================
// File        : ClientController.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : API endpoints for client search, auto-fill, and global client management.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Models;
using CPS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/clients")]
[Authorize(Roles = "Scanner,MobileScanner,Maker,Checker,Admin,Developer")]
public class ClientController : ControllerBase
{
    private readonly IClientRepository _clientRepo;

    public ClientController(IClientRepository clientRepo) => _clientRepo = clientRepo;

    // ── Client endpoints ──────────────────────────────────────────────────────

    [HttpGet("all")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _clientRepo.GetAllAsync();
        return Ok(ApiResponse<List<ClientDto>>.Ok(items.Select(ToDto).ToList()));
    }

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] int? globalClientId = null,
        [FromQuery] bool? isPriority = null,
        [FromQuery] string? cityCode = null,
        [FromQuery] string? clientName = null,
        [FromQuery] string? rcmsCode = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);
        var items = await _clientRepo.SearchAsync(q, page, pageSize, globalClientId, isPriority, cityCode, clientName, rcmsCode);
        var total = await _clientRepo.GetSearchCountAsync(q, globalClientId, isPriority, cityCode, clientName, rcmsCode);

        return Ok(ApiResponse<PagedResult<ClientDto>>.Ok(new PagedResult<ClientDto>
        {
            Items = items.Select(ToDto).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        }));
    }


    [HttpGet("{code}")]
    public async Task<IActionResult> GetByCode(string code)
    {
        var c = await _clientRepo.GetByCodeAsync(code);
        if (c == null || c.Status != "A")
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Client not found or inactive."));

        return Ok(ApiResponse<ClientDto>.Ok(ToDto(c)));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> UpdateClient(int id, [FromBody] ClientDto dto)
    {
        var client = await _clientRepo.GetByIdAsync(id);
        if (client == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Client not found."));

        if (dto.CityCode != null) client.CityCode = dto.CityCode;
        if (dto.ClientName != null) client.ClientName = dto.ClientName;
        if (dto.Address1 != null) client.Address1 = dto.Address1;
        if (dto.Address2 != null) client.Address2 = dto.Address2;
        if (dto.PickupPointCode != null) client.PickupPointCode = dto.PickupPointCode;
        if (dto.PickupPointDesc != null) client.PickupPointDesc = dto.PickupPointDesc;
        if (dto.RCMSCode != null) client.RCMSCode = dto.RCMSCode;
        if (dto.Status != null) client.Status = dto.Status;
        if (dto.IsPriority != null) client.IsPriority = dto.IsPriority.Value;
        
        // Handle GlobalClientID specifically (can be null/zero)
        client.GlobalClientID = dto.GlobalClientID;

        client.UpdatedAt = DateTime.UtcNow;

        await _clientRepo.UpdateAsync(client);
        return Ok(ApiResponse<ClientDto>.Ok(ToDto(client)));
    }


    // ── Global Client endpoints ───────────────────────────────────────────────

    [HttpGet("global")]
    public async Task<IActionResult> GetGlobalClients()
    {
        var items = await _clientRepo.GetAllGlobalClientsAsync();
        var dtos = items.Select(g => new GlobalClientDto
        {
            GlobalClientID = g.GlobalClientID,
            GlobalCode = g.GlobalCode,
            GlobalName = g.GlobalName,
            IsPriority = g.IsPriority,
            IsActive = g.IsActive,
            LinkedClientCount = g.Clients.Count
        }).ToList();

        return Ok(ApiResponse<List<GlobalClientDto>>.Ok(dtos));
    }

    [HttpPost("global")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> CreateGlobalClient([FromBody] CreateGlobalClientRequest req)
    {
        var existing = await _clientRepo.GetGlobalClientByCodeAsync(req.GlobalCode);
        if (existing != null)
            return BadRequest(ApiResponse<object>.Fail("DUPLICATE_CODE", $"GlobalCode '{req.GlobalCode}' already exists."));

        var globalClient = new GlobalClient
        {
            GlobalCode = req.GlobalCode.ToUpper().Trim(),
            GlobalName = req.GlobalName.Trim(),
            IsPriority = req.IsPriority,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        var created = await _clientRepo.CreateGlobalClientAsync(globalClient);
        return Ok(ApiResponse<GlobalClientDto>.Ok(new GlobalClientDto
        {
            GlobalClientID = created.GlobalClientID,
            GlobalCode = created.GlobalCode,
            GlobalName = created.GlobalName,
            IsPriority = created.IsPriority,
            IsActive = created.IsActive,
            LinkedClientCount = 0
        }));
    }

    [HttpPut("global/{id:int}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> UpdateGlobalClient(int id, [FromBody] UpdateGlobalClientRequest req)
    {
        var globalClient = await _clientRepo.GetGlobalClientByIdAsync(id);
        if (globalClient == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Global client not found."));

        globalClient.GlobalName = req.GlobalName.Trim();
        globalClient.IsPriority = req.IsPriority;
        globalClient.IsActive = req.IsActive;
        globalClient.UpdatedAt = DateTime.UtcNow;

        await _clientRepo.UpdateGlobalClientAsync(globalClient);

        // If IsPriority changed, sync all linked clients
        if (globalClient.Clients.Count > 0)
        {
            var clientIds = globalClient.Clients.Select(c => c.ClientID).ToList();
            await _clientRepo.LinkClientsToGlobalAsync(id, clientIds);
        }

        return Ok(ApiResponse<string>.Ok("Updated successfully."));
    }

    [HttpDelete("global/{id:int}")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> DeleteGlobal(int id)

    {
        var globalClient = await _clientRepo.GetGlobalClientByIdAsync(id);
        if (globalClient == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Global client not found."));

        await _clientRepo.DeleteGlobalClientAsync(id);
        return Ok(ApiResponse<string>.Ok("Deleted successfully."));
    }


    [HttpPost("global/{id:int}/link")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> LinkClients(int id, [FromBody] LinkGlobalClientRequest req)
    {
        var globalClient = await _clientRepo.GetGlobalClientByIdAsync(id);
        if (globalClient == null)
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Global client not found."));

        await _clientRepo.LinkClientsToGlobalAsync(id, req.ClientIDs);
        return Ok(ApiResponse<string>.Ok($"Linked {req.ClientIDs.Count} client(s) to {globalClient.GlobalCode}."));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private static ClientDto ToDto(ClientMaster c) => new()
    {
        ClientID = c.ClientID,
        CityCode = c.CityCode,
        ClientName = c.ClientName,
        Address1 = c.Address1,
        Address2 = c.Address2,
        PickupPointCode = c.PickupPointCode,
        PickupPointDesc = c.PickupPointDesc,
        RCMSCode = c.RCMSCode,
        Status = c.Status,
        GlobalClientID = c.GlobalClientID,
        GlobalCode = c.GlobalClient?.GlobalCode,
        GlobalName = c.GlobalClient?.GlobalName,
        IsPriority = (bool?)c.IsPriority,

    };
}
