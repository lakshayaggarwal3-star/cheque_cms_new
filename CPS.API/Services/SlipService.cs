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
    private readonly IAuditService _audit;

    public SlipService(ISlipRepository slipRepo, IClientRepository clientRepo,
        IBatchRepository batchRepo, IAuditService audit)
    {
        _slipRepo = slipRepo;
        _clientRepo = clientRepo;
        _batchRepo = batchRepo;
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

        if (await _slipRepo.SlipNoExistsAsync(request.BatchID, request.SlipNo))
            throw new ConflictException($"Slip No '{request.SlipNo}' already exists in this batch.");

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
            SlipNo = request.SlipNo.Trim(),
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

    public async Task<ClientAutoFillDto?> GetClientAutoFillAsync(string clientCode)
    {
        var client = await _clientRepo.GetByCodeAsync(clientCode.Trim());
        if (client == null || !IsClientActive(client.Status)) return null;

        return new ClientAutoFillDto
        {
            CityCode = client.CityCode,
            ClientName = client.ClientName,
            PickupPointCode = client.PickupPointCode,
            PickupPointDesc = client.PickupPointDesc,
            RCMSCode = client.RCMSCode
        };
    }

    private static bool IsClientActive(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return false;
        var normalized = status.Trim().ToUpperInvariant();
        return normalized is "A" or "ACTIVE" or "Y" or "1";
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
