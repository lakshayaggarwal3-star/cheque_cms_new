// =============================================================================
// File        : SlipService.cs
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Business logic for SlipEntry creation, update, and client auto-fill.
// Created     : 2026-04-17
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CPS.API.Services;

public class SlipService : ISlipService
{
    private readonly ISlipEntryRepository _slipRepo;
    private readonly IClientRepository _clientRepo;
    private readonly IBatchRepository _batchRepo;
    private readonly ILocationRepository _locationRepo;
    private readonly IAuditService _audit;

    public SlipService(ISlipEntryRepository slipRepo, IClientRepository clientRepo,
        IBatchRepository batchRepo, ILocationRepository locationRepo, IAuditService audit)
    {
        _slipRepo = slipRepo;
        _clientRepo = clientRepo;
        _batchRepo = batchRepo;
        _locationRepo = locationRepo;
        _audit = audit;
    }

    public async Task<List<SlipEntryDto>> GetByBatchAsync(long batchId)
    {
        var entries = await _slipRepo.GetByBatchAsync(batchId);
        return entries.Select(MapToDto).ToList();
    }

    public async Task<SlipEntryDto> CreateSlipEntryAsync(CreateSlipEntryRequest request, int userId)
    {
        var batch = await _batchRepo.GetByIdAsync(request.BatchId)
            ?? throw new NotFoundException($"Batch {request.BatchId} not found.");

        if (request.TotalInstruments <= 0)
            throw new ValidationException("Total instruments must be greater than 0.");

        if (request.SlipAmount <= 0)
            throw new ValidationException("Slip amount must be greater than 0.");

        if (!string.IsNullOrWhiteSpace(request.ClientCode))
        {
            var client = await _clientRepo.GetByCodeAsync(request.ClientCode.Trim());
            if (client == null || !IsClientActive(client.Status))
                throw new ValidationException($"Client code '{request.ClientCode}' not found or inactive.");
        }

        var slipNo = await _slipRepo.GenerateNextSlipNoAsync(
            request.BatchId, batch.LocationID, batch.ScannerMappingID);

        var entry = new SlipEntry
        {
            BatchId = request.BatchId,
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

        await _slipRepo.CreateAsync(entry);
        await _audit.LogAsync("SlipEntry", entry.SlipEntryId.ToString(), "INSERT",
            null, new { entry.SlipNo, entry.BatchId, entry.ClientName, entry.PickupPoint, entry.TotalInstruments, entry.SlipAmount }, 
            userId, batchNo: batch.BatchNo);

        return MapToDto(entry);
    }

    public async Task<SlipEntryDto> UpdateSlipEntryAsync(long slipEntryId, UpdateSlipEntryRequest request, int userId)
    {
        var entry = await _slipRepo.GetByIdAsync(slipEntryId)
            ?? throw new NotFoundException($"Slip entry {slipEntryId} not found.");

        if (request.TotalInstruments <= 0)
            throw new ValidationException("Total instruments must be greater than 0.");

        if (request.SlipAmount <= 0)
            throw new ValidationException("Slip amount must be greater than 0.");

        var old = new { entry.ClientCode, entry.SlipAmount, entry.TotalInstruments };

        entry.ClientCode = request.ClientCode?.Trim();
        entry.ClientName = request.ClientName?.Trim();
        entry.DepositSlipNo = request.DepositSlipNo?.Trim();
        entry.PickupPoint = request.PickupPoint?.Trim();
        entry.TotalInstruments = request.TotalInstruments;
        entry.SlipAmount = request.SlipAmount;
        entry.Remarks = request.Remarks?.Trim();
        entry.UpdatedBy = userId;
        entry.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _slipRepo.UpdateAsync(entry);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("Slip entry was modified by another user. Refresh and try again.");
        }

        var batch = await _batchRepo.GetByIdAsync(entry.BatchId);
        await _audit.LogAsync("SlipEntry", slipEntryId.ToString(), "UPDATE", old,
            new { entry.ClientCode, entry.ClientName, entry.SlipAmount, entry.TotalInstruments, entry.PickupPoint, entry.DepositSlipNo }, 
            userId, batchNo: batch?.BatchNo);

        return MapToDto(entry);
    }

    public async Task<ClientAutoFillDto?> GetClientAutoFillAsync(string clientCode, int userLocationId)
    {
        var client = await _clientRepo.GetByCodeAsync(clientCode.Trim());
        if (client == null) return null;

        var userLocation = await _locationRepo.GetByIdAsync(userLocationId);
        if (userLocation == null) return null;

        var cityCode = client.CityCode?.Trim().ToUpperInvariant() ?? "";
        var locationName = userLocation.LocationName?.Trim().ToUpperInvariant() ?? "";
        var locationCode = userLocation.LocationCode?.Trim().ToUpperInvariant() ?? "";
        var clusterCode = userLocation.ClusterCode?.Trim().ToUpperInvariant() ?? "";

        var isApplicable = !string.IsNullOrEmpty(cityCode) && (
            cityCode.Equals(locationName) ||
            cityCode.Equals(locationCode) ||
            cityCode.Equals(clusterCode));

        if (!isApplicable) return null;

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

    public async Task<List<ClientAutoFillDto>> GetClientsByLocationAsync(int userLocationId)
    {
        var userLocation = await _locationRepo.GetByIdAsync(userLocationId)
            ?? throw new NotFoundException($"Location {userLocationId} not found.");

        var locationName = userLocation.LocationName?.Trim() ?? "";
        var locationCode = userLocation.LocationCode?.Trim() ?? "";
        var clusterCode = userLocation.ClusterCode?.Trim() ?? "";

        var filteredClients = await _clientRepo.GetByLocationCodesAsync(locationName, locationCode, clusterCode);

        var result = new List<ClientAutoFillDto>();
        foreach (var client in filteredClients)
        {
            result.Add(new ClientAutoFillDto
            {
                CityCode = client.CityCode,
                ClientName = client.ClientName,
                PickupPointCode = client.PickupPointCode,
                PickupPointDesc = client.PickupPointDesc,
                RCMSCode = client.RCMSCode,
                Status = client.Status
            });
        }
        return result;
    }

    public async Task<string> GenerateNextSlipNoAsync(long batchId)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId)
            ?? throw new NotFoundException($"Batch {batchId} not found.");
        return await _slipRepo.GenerateNextSlipNoAsync(batchId, batch.LocationID, batch.ScannerMappingID);
    }

    private static bool IsClientActive(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return true; // Default to active if status is missing
        var s = status.Trim().ToUpperInvariant();
        
        // Explicitly inactive codes
        if (s is "I" or "X" or "0" or "INACTIVE" or "DELETED") return false;
        
        // Everything else is considered active
        return true;
    }

    internal static SlipEntryDto MapToDto(SlipEntry s) => new()
    {
        SlipEntryId = s.SlipEntryId,
        BatchId = s.BatchId,
        SlipNo = s.SlipNo,
        ClientCode = s.ClientCode,
        ClientName = s.ClientName,
        DepositSlipNo = s.DepositSlipNo,
        PickupPoint = s.PickupPoint,
        TotalInstruments = s.TotalInstruments,
        SlipAmount = s.SlipAmount,
        Remarks = s.Remarks,
        SlipStatus = s.SlipStatus,
        CreatedAt = s.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
        RowVersion = s.RowVersion,
        SlipScans = s.SlipScans.Select(ss => new SlipScanDto
        {
            SlipScanId = ss.SlipScanId,
            SlipEntryId = ss.SlipEntryId,
            ScanOrder = ss.ScanOrder,
            RetryCount = ss.RetryCount,
            ImageBaseName = ss.ImageBaseName,
            FileExtension = ss.FileExtension,
            ImageHash = ss.ImageHash
        }).ToList(),
        Cheques = s.ChequeItems.Select(c => new ChequeItemDto
        {
            ChequeItemId = c.ChequeItemId,
            SlipEntryId = c.SlipEntryId,
            BatchId = c.BatchId,
            SeqNo = c.SeqNo,
            ChqSeq = c.ChqSeq,
            ChqNo = c.ChqNo,
            MICRRaw = c.MICRRaw,
            ScanMICR1 = c.ScanMICR1,
            ScanMICR2 = c.ScanMICR2,
            ScanMICR3 = c.ScanMICR3,
            RRMICR1 = c.RRMICR1,
            RRMICR2 = c.RRMICR2,
            RRMICR3 = c.RRMICR3,
            RRNotes = c.RRNotes,
            RRState = c.RRState,
            RetryCount = c.RetryCount,
            ImageBaseName = c.ImageBaseName,
            FileExtension = c.FileExtension,
            ImageHash = c.ImageHash
        }).ToList()
    };
}
