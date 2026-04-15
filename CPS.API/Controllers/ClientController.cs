// =============================================================================
// File        : ClientController.cs
// Project     : CPS — Cheque Processing System
// Module      : Client Master
// Description : API endpoints for client search and auto-fill retrieval.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/clients")]
[Authorize]
public class ClientController : ControllerBase
{
    private readonly IClientRepository _clientRepo;

    public ClientController(IClientRepository clientRepo) => _clientRepo = clientRepo;

    [HttpGet("all")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _clientRepo.GetAllAsync();
        var dtos = items.Select(c => new ClientDto
        {
            ClientID = c.ClientID,
            CityCode = c.CityCode,
            ClientName = c.ClientName,
            Address1 = c.Address1,
            Address2 = c.Address2,
            PickupPointCode = c.PickupPointCode,
            PickupPointDesc = c.PickupPointDesc,
            RCMSCode = c.RCMSCode,
            Status = c.Status
        }).ToList();

        return Ok(ApiResponse<List<ClientDto>>.Ok(dtos));
    }

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Min(pageSize, 100);
        var items = await _clientRepo.SearchAsync(q, page, pageSize);
        var total = await _clientRepo.GetSearchCountAsync(q);

        var dtos = items.Select(c => new ClientDto
        {
            ClientID = c.ClientID,
            CityCode = c.CityCode,
            ClientName = c.ClientName,
            Address1 = c.Address1,
            Address2 = c.Address2,
            PickupPointCode = c.PickupPointCode,
            PickupPointDesc = c.PickupPointDesc,
            RCMSCode = c.RCMSCode,
            Status = c.Status
        }).ToList();

        return Ok(ApiResponse<PagedResult<ClientDto>>.Ok(new PagedResult<ClientDto>
        {
            Items = dtos,
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

        return Ok(ApiResponse<ClientDto>.Ok(new ClientDto
        {
            ClientID = c.ClientID,
            CityCode = c.CityCode,
            ClientName = c.ClientName,
            Address1 = c.Address1,
            Address2 = c.Address2,
            PickupPointCode = c.PickupPointCode,
            PickupPointDesc = c.PickupPointDesc,
            RCMSCode = c.RCMSCode,
            Status = c.Status
        }));
    }
}
