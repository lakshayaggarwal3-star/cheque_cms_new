// =============================================================================
// File        : UserController.cs
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : API endpoints for user CRUD, location assignment, and account management.
// Created     : 2026-04-14
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin,Developer")]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;

    public UserController(IUserService userService) => _userService = userService;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _userService.GetAllAsync();
        return Ok(ApiResponse<List<UserDto>>.Ok(users));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var user = await _userService.GetByIdAsync(id);
        return Ok(ApiResponse<UserDto>.Ok(user));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var createdBy = int.Parse(User.FindFirstValue("userId")!);
        var result = await _userService.CreateAsync(request, createdBy);
        return StatusCode(201, ApiResponse<UserDto>.Ok(result, "User created"));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request)
    {
        var updatedBy = int.Parse(User.FindFirstValue("userId")!);
        var result = await _userService.UpdateAsync(id, request, updatedBy);
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpPut("{id:int}/location")]
    public async Task<IActionResult> AssignLocation(int id, [FromBody] AssignLocationRequest request)
    {
        var assignedBy = int.Parse(User.FindFirstValue("userId")!);
        await _userService.AssignLocationAsync(id, request, assignedBy);
        return Ok(ApiResponse<object>.Ok(null, "Location assigned"));
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromQuery] bool isActive)
    {
        var updatedBy = int.Parse(User.FindFirstValue("userId")!);
        await _userService.SetStatusAsync(id, isActive, updatedBy);
        return Ok(ApiResponse<object>.Ok(null, $"User {(isActive ? "activated" : "deactivated")}"));
    }

    [HttpPut("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordRequest request)
    {
        var updatedBy = int.Parse(User.FindFirstValue("userId")!);
        await _userService.ResetPasswordAsync(id, request, updatedBy);
        return Ok(ApiResponse<object>.Ok(null, "Password reset"));
    }

    [HttpPut("{id:int}/unlock")]
    public async Task<IActionResult> Unlock(int id)
    {
        var updatedBy = int.Parse(User.FindFirstValue("userId")!);
        await _userService.UnlockAsync(id, updatedBy);
        return Ok(ApiResponse<object>.Ok(null, "User unlocked"));
    }
}
