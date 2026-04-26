// =============================================================================
// File        : UserSettingsController.cs
// Project     : CPS — Cheque Processing System
// Module      : User Settings
// Description : GET + PUT endpoints for per-user settings — all roles.
// Created     : 2026-04-24
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/users/me/settings")]
[Authorize]
public class UserSettingsController : ControllerBase
{
    private readonly IUserSettingRepository _repo;

    public UserSettingsController(IUserSettingRepository repo) => _repo = repo;

    private int CurrentUserId => int.Parse(
        User.FindFirstValue("userId")
        ?? throw new InvalidOperationException("User identity missing from token."));

    // GET /api/users/me/settings
    // Returns all settings for the current user as a flat key-value dictionary.
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _repo.GetAllAsync(CurrentUserId);
        return Ok(ApiResponse<Dictionary<string, string>>.Ok(settings));
    }

    // PUT /api/users/me/settings/{key}
    // Upserts a single setting value.
    [HttpPut("{key}")]
    public async Task<IActionResult> Upsert(string key, [FromBody] UpsertSettingRequest request)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ValidationException("Setting key is required.");
        if (string.IsNullOrWhiteSpace(request.Value))
            throw new ValidationException("Setting value is required.");

        await _repo.UpsertAsync(CurrentUserId, key.Trim(), request.Value.Trim());
        return Ok(ApiResponse<object>.Ok(null, "Setting saved."));
    }
}
