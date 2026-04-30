// =============================================================================
// File        : AuthController.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Handles login, logout, change-password, and /me endpoints.
// Created     : 2026-04-14
// =============================================================================

using System.Security.Claims;
using CPS.API.DTOs;
using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService) => _authService = authService;

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);

        // Generate JWT and set httpOnly cookie
        var authService = (AuthService)_authService;
        var roles = result.Roles;
        // Re-read user to get session token for JWT (already set in LoginAsync)
        // Token embedded in cookie
        var token = authService.GenerateJwtFromResponse(result);

        Response.Cookies.Append("jwt", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,   // Lax works on mobile; Strict can block cookies on redirects
            Expires = DateTimeOffset.UtcNow.AddHours(8)
        });

        return Ok(ApiResponse<LoginResponse>.Ok(result, "Login successful"));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _authService.LogoutAsync(userId);
        Response.Cookies.Delete("jwt");
        return Ok(ApiResponse<object>.Ok(null, "Logged out successfully"));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        await _authService.ChangePasswordAsync(userId, request);
        return Ok(ApiResponse<object>.Ok(null, "Password changed successfully"));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = int.Parse(User.FindFirstValue("userId")!);
        var eodDate = User.FindFirstValue("eodDate") ?? string.Empty;
        var result = await _authService.GetMeAsync(userId, eodDate);
        return Ok(ApiResponse<UserMeResponse>.Ok(result));
    }
}
