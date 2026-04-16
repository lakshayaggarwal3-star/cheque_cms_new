// =============================================================================
// File        : SlipService.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Business logic for slip creation, validation, and client auto-fill during scanning.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Services;

public class SlipService : ISlipService
{
    private readonly ISlipRepository _slipRepo;
    private readonly IClientRepository _clientRepo;
    private readonly IBatchRepository _batchRepo;
    private readonly ILocationRepository _locationRepo;
    private readonly IAuditService _audit;

    public SlipService(ISlipRepository slipRepo, IClientRepository clientRepo,
        IBatchRepository batchRepo, ILocationRepository locationRepo, IAuditService audit)
    {
        _slipRepo = slipRepo;
        _clientRepo = clientRepo;
        _batchRepo = batchRepo;
        _locationRepo = locationRepo;
        _audit = audit;
    }

    public async Task<List<SlipDto>> GetByBatchAsync(long batchId)
    {
        var slips = await _slipRepo.GetByBatchAsync(batchId);
        return slips.Select(MapToDto).ToList();
    }

    public async Task<SlipDto> CreateSlipAsync(CreateSlipRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(request.BatchID)
            ?? throw new NotFoundException($"Batch {request.BatchID} not found.");

        // Auto-generate Slip No if not provided (format: {ScannerID}{2-digit-seq})
        string slipNo;
        if (string.IsNullOrWhiteSpace(request.SlipNo))
        {
            slipNo = await _slipRepo.GenerateNextSlipNoAsync(batch.LocationID, batch.ScannerMappingID);
        }
        else
        {
            slipNo = request.SlipNo.Trim();
            if (await _slipRepo.SlipNoExistsAsync(request.BatchID, slipNo))
                throw new ConflictException($"Slip No '{slipNo}' already exists in this batch.");
        }

        if (!string.IsNullOrWhiteSpace(request.ClientCode))
        {
            var client = await _clientRepo.GetByCodeAsync(request.ClientCode.Trim());
            if (client == null || !IsClientActive(client.Status))
                throw new ValidationException($"Client code '{request.ClientCode}' not found or inactive.");
        }

        if (request.TotalInstruments <= 0)
            throw new ValidationException("Total instruments must be greater than 0.");

        if (request.SlipAmount <= 0)
            throw new ValidationException("Slip amount must be greater than 0.");

        var slip = new Slip
        {
            BatchID = request.BatchID,
            SlipNo = slipNo,
            ClientCode = request.ClientCode?.Trim(),
            ClientName = request.ClientName?.Trim(),
            DepositSlipNo = request.DepositSlipNo?.Trim(),
            PickupPoint = request.PickupPoint?.Trim(),
            TotalInstruments = request.TotalInstruments,
            SlipAmount = request.SlipAmount,
            Remarks = request.Remarks?.Trim(),
            SlipStatus = (int)SlipStatus.Open,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _slipRepo.CreateAsync(slip);
        await _audit.LogAsync("Slip", slip.SlipID.ToString(), "INSERT", null, new { slip.SlipNo, slip.BatchID }, userId);

        return MapToDto(slip);
    }

    public async Task<SlipDto> UpdateSlipAsync(int slipId, UpdateSlipRequest request, int userId)
    {
        var slip = await _slipRepo.GetByIdAsync(slipId)
            ?? throw new NotFoundException($"Slip {slipId} not found.");

        if (await _slipRepo.SlipNoExistsAsync(slip.BatchID, request.SlipNo, slipId))
            throw new ConflictException($"Slip No '{request.SlipNo}' already exists in this batch.");

        var old = new { slip.SlipNo, slip.ClientCode, slip.SlipAmount };

        slip.SlipNo = request.SlipNo.Trim();
        slip.ClientCode = request.ClientCode?.Trim();
        slip.ClientName = request.ClientName?.Trim();
        slip.DepositSlipNo = request.DepositSlipNo?.Trim();
        slip.PickupPoint = request.PickupPoint?.Trim();
        slip.TotalInstruments = request.TotalInstruments;
        slip.SlipAmount = request.SlipAmount;
        slip.Remarks = request.Remarks?.Trim();
        slip.UpdatedBy = userId;
        slip.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _slipRepo.UpdateAsync(slip);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("Slip was modified by another user. Refresh and try again.");
        }

        await _audit.LogAsync("Slip", slipId.ToString(), "UPDATE", old,
            new { slip.SlipNo, slip.ClientCode, slip.SlipAmount }, userId);

        return MapToDto(slip);
    }

    public async Task<ClientAutoFillDto?> GetClientAutoFillAsync(string clientCode, int userLocationId)
    {
        var client = await _clientRepo.GetByCodeAsync(clientCode.Trim());
        if (client == null) return null;

        // Get user's location to validate client's CityCode matches location's fields
        var userLocation = await _locationRepo.GetByIdAsync(userLocationId);
        if (userLocation == null) return null;

        // Check if client's CityCode matches ANY of user's Location's three fields:
        // - LocationName, LocationCode, or ClusterCode
        // If any match, consider it applicable to this location
        var cityCode = client.CityCode?.Trim().ToUpperInvariant() ?? "";
        var locationName = userLocation.LocationName?.Trim().ToUpperInvariant() ?? "";
        var locationCode = userLocation.LocationCode?.Trim().ToUpperInvariant() ?? "";
        var clusterCode = userLocation.ClusterCode?.Trim().ToUpperInvariant() ?? "";

        var isApplicable =
            !string.IsNullOrEmpty(cityCode) && (
                cityCode.Equals(locationName) ||
                cityCode.Equals(locationCode) ||
                cityCode.Equals(clusterCode)
            );

        if (!isApplicable)
            return null;

        // Return client data (frontend will show status warning if inactive)
        return new ClientAutoFillDto
        {
            CityCode = client.CityCode,
            ClientName = client.ClientName,
            PickupPointCode = client.PickupPointCode,
            PickupPointDesc = client.PickupPointDesc,
            RCMSCode = client.RCMSCode,
            Status = client.Status
        };
    }

    private static bool IsClientActive(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return false;
        var normalized = status.Trim().ToUpperInvariant();
        return normalized is "A" or "ACTIVE" or "Y" or "1";
    }

    public async Task<List<ClientAutoFillDto>> GetClientsByLocationAsync(int userLocationId)
    {
        // Get user's location
        var userLocation = await _locationRepo.GetByIdAsync(userLocationId)
            ?? throw new NotFoundException($"Location {userLocationId} not found.");

        // Get all clients
        var allClients = await _clientRepo.GetAllAsync();

        // Filter clients that match ANY of the location's three fields
        var locationName = userLocation.LocationName?.Trim().ToUpperInvariant() ?? "";
        var locationCode = userLocation.LocationCode?.Trim().ToUpperInvariant() ?? "";
        var clusterCode = userLocation.ClusterCode?.Trim().ToUpperInvariant() ?? "";

        var matchingClients = new List<ClientAutoFillDto>();
        foreach (var client in allClients)
        {
            var cityCode = client.CityCode?.Trim().ToUpperInvariant() ?? "";

            if (!string.IsNullOrEmpty(cityCode) && (
                cityCode.Equals(locationName) ||
                cityCode.Equals(locationCode) ||
                cityCode.Equals(clusterCode)))
            {
                matchingClients.Add(new ClientAutoFillDto
                {
                    CityCode = client.CityCode,
                    ClientName = client.ClientName,
                    PickupPointCode = client.PickupPointCode,
                    PickupPointDesc = client.PickupPointDesc,
                    RCMSCode = client.RCMSCode,
                    Status = client.Status
                });
            }
        }

        return matchingClients;
    }

    public async Task<string> GenerateNextSlipNoAsync(long batchId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");

        return await _slipRepo.GenerateNextSlipNoAsync(batch.LocationID, batch.ScannerMappingID);
    }

    private static SlipDto MapToDto(Slip s) => new()
    {
        SlipID = s.SlipID,
        BatchID = s.BatchID,
        SlipNo = s.SlipNo,
        ClientCode = s.ClientCode,
        ClientName = s.ClientName,
        DepositSlipNo = s.DepositSlipNo,
        PickupPoint = s.PickupPoint,
        TotalInstruments = s.TotalInstruments,
        SlipAmount = s.SlipAmount,
        Remarks = s.Remarks,
        SlipStatus = s.SlipStatus,
        LinkedCheques = s.ScanItems?.Count(i => !i.IsSlip) ?? 0,
        CreatedAt = s.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
        RowVersion = s.RowVersion
    };
}
