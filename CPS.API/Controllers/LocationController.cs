// =============================================================================
// File        : LocationController.cs
// Project     : CPS — Cheque Processing System
// Module      : Location Master
// Description : API endpoints for location listing, detail, and scanner retrieval.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/locations")]
[Authorize]
public class LocationController : ControllerBase
{
    private readonly ILocationRepository _locationRepo;

    public LocationController(ILocationRepository locationRepo) => _locationRepo = locationRepo;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var locs = await _locationRepo.GetAllAsync();
        var dtos = locs.Select(l => new LocationDto
        {
            LocationID = l.LocationID,
            LocationName = l.LocationName,
            LocationCode = l.LocationCode,
            State = l.State,
            Grid = l.Grid,
            ClusterCode = l.ClusterCode,
            Zone = l.Zone,
            LocType = l.LocType,
            PIFPrefix = l.PIFPrefix,
            IsActive = l.IsActive,
            Scanners = l.Scanners.Select(s => new ScannerDto
            {
                ScannerMappingID = s.ScannerMappingID,
                ScannerID = s.ScannerID,
                ScannerModel = s.ScannerModel,
                ScannerType = s.ScannerType,
                IsActive = s.IsActive
            }).ToList(),
            Finance = l.Finance == null ? null : new LocationFinanceDto
            {
                BOFD = l.Finance.BOFD,
                PreTrun = l.Finance.PreTrun,
                DepositAccount = l.Finance.DepositAccount,
                IFSC = l.Finance.IFSC
            }
        }).ToList();

        return Ok(ApiResponse<List<LocationDto>>.Ok(dtos));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var l = await _locationRepo.GetByIdAsync(id);
        if (l == null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Location not found."));

        var dto = new LocationDto
        {
            LocationID = l.LocationID,
            LocationName = l.LocationName,
            LocationCode = l.LocationCode,
            State = l.State,
            Grid = l.Grid,
            ClusterCode = l.ClusterCode,
            Zone = l.Zone,
            LocType = l.LocType,
            PIFPrefix = l.PIFPrefix,
            IsActive = l.IsActive,
            Scanners = l.Scanners.Select(s => new ScannerDto
            {
                ScannerMappingID = s.ScannerMappingID,
                ScannerID = s.ScannerID,
                ScannerModel = s.ScannerModel,
                ScannerType = s.ScannerType,
                IsActive = s.IsActive
            }).ToList(),
            Finance = l.Finance == null ? null : new LocationFinanceDto
            {
                BOFD = l.Finance.BOFD,
                PreTrun = l.Finance.PreTrun,
                DepositAccount = l.Finance.DepositAccount,
                IFSC = l.Finance.IFSC
            }
        };

        return Ok(ApiResponse<LocationDto>.Ok(dto));
    }

    [HttpGet("{id:int}/scanners")]
    public async Task<IActionResult> GetScanners(int id)
    {
        var scanners = await _locationRepo.GetScannersAsync(id);
        var dtos = scanners.Select(s => new ScannerDto
        {
            ScannerMappingID = s.ScannerMappingID,
            ScannerID = s.ScannerID,
            ScannerModel = s.ScannerModel,
            ScannerType = s.ScannerType,
            IsActive = s.IsActive
        }).ToList();
        return Ok(ApiResponse<List<ScannerDto>>.Ok(dtos));
    }
}
