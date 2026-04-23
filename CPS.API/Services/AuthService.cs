// =============================================================================
// File        : AuthService.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Handles login validation, bcrypt verification, JWT generation, and session management.
// Created     : 2026-04-14
// =============================================================================

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;
using Microsoft.IdentityModel.Tokens;

namespace CPS.API.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _users;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(IUserRepository users, IConfiguration config, ILogger<AuthService> logger)
    {
        _users = users;
        _config = config;
        _logger = logger;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var user = await _users.GetByLoginIdAsync(request.LoginId.Trim());

        if (user == null)
        {
            _logger.LogWarning("Login failed — user not found: {LoginId}", request.LoginId);
            throw new ValidationException("Invalid credentials.");
        }

        if (!user.IsActive)
            throw new ValidationException("Account is inactive. Contact admin.");

        if (user.IsLocked)
            throw new ValidationException("Account is locked due to too many failed attempts. Contact admin.");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            user.LoginAttempts++;
            if (user.LoginAttempts >= 5)
            {
                user.IsLocked = true;
                _logger.LogWarning("Account locked after 5 failed attempts: {EmployeeID}", user.EmployeeID);
            }
            user.UpdatedAt = DateTime.UtcNow;
            await _users.UpdateAsync(user);
            throw new ValidationException("Invalid credentials.");
        }

        if (user.IsLoggedIn && !request.ForceLogin)
            throw new ConflictException("User already logged in. Pass forceLogin=true to override.");

        // Rotate session token
        user.SessionToken = Guid.NewGuid();
        user.IsLoggedIn = true;
        user.LoginAttempts = 0;
        user.UpdatedAt = DateTime.UtcNow;
        await _users.UpdateAsync(user);

        var today = DateOnly.FromDateTime(DateTime.Today);
        var location = await _users.GetCurrentLocationAsync(user.UserID, today);

        var roles = BuildRolesList(user);
        var token = GenerateJwt(user, roles, location?.LocationID ?? 0, today.ToString("yyyy-MM-dd"));

        _logger.LogInformation("Login success: UserID={UserId} EmployeeID={EmployeeID}", user.UserID, user.EmployeeID);

        return new LoginResponse
        {
            UserId = user.UserID,
            EmployeeId = user.EmployeeID,
            Username = user.Username,
            Roles = roles,
            LocationId = location?.LocationID ?? 0,
            LocationName = location?.LocationName ?? string.Empty,
            EodDate = today.ToString("yyyy-MM-dd"),
            IsDeveloper = user.IsDeveloper
        };
    }

    public async Task LogoutAsync(int userId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return;

        user.IsLoggedIn = false;
        user.SessionToken = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _users.UpdateAsync(user);
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest request)
    {
        var user = await _users.GetByIdAsync(userId)
            ?? throw new NotFoundException("User not found.");

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            throw new ValidationException("Current password is incorrect.");

        if (request.NewPassword.Length < 8)
            throw new ValidationException("New password must be at least 8 characters.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, 12);
        user.UpdatedAt = DateTime.UtcNow;
        user.UpdatedBy = userId;
        await _users.UpdateAsync(user);
    }

    public async Task<UserMeResponse> GetMeAsync(int userId, string eodDate)
    {
        var user = await _users.GetByIdAsync(userId)
            ?? throw new NotFoundException("User not found.");

        var today = DateOnly.FromDateTime(DateTime.Today);
        var location = await _users.GetCurrentLocationAsync(user.UserID, today);
        var roles = BuildRolesList(user);

        return new UserMeResponse
        {
            UserId = user.UserID,
            EmployeeId = user.EmployeeID,
            Username = user.Username,
            Roles = roles,
            LocationId = location?.LocationID ?? 0,
            LocationName = location?.LocationName ?? string.Empty,
            EodDate = eodDate,
            IsDeveloper = user.IsDeveloper
        };
    }

    private List<string> BuildRolesList(UserMaster user)
    {
        var roles = new List<string>();
        if (user.RoleScanner) roles.Add("Scanner");
        if (user.RoleMobileScanner) roles.Add("MobileScanner");
        if (user.RoleMaker) roles.Add("Maker");
        if (user.RoleChecker) roles.Add("Checker");
        if (user.RoleAdmin) roles.Add("Admin");
        if (user.RoleImageViewer) roles.Add("ImageViewer");
        if (user.IsDeveloper) roles.Add("Developer");
        return roles;
    }

    public string GenerateJwt(UserMaster user, List<string> roles, int locationId, string eodDate)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:SecretKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = int.Parse(_config["Jwt:ExpiryHours"] ?? "8");

        var claims = new List<Claim>
        {
            new("userId", user.UserID.ToString()),
            new("employeeId", user.EmployeeID),
            new("locationId", locationId.ToString()),
            new("eodDate", eodDate),
            new("sessionToken", user.SessionToken.ToString()!)
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiry),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>Generates JWT from a LoginResponse (used by controller to set cookie).</summary>
    public string GenerateJwtFromResponse(LoginResponse r)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:SecretKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = int.Parse(_config["Jwt:ExpiryHours"] ?? "8");

        var claims = new List<Claim>
        {
            new("userId", r.UserId.ToString()),
            new("employeeId", r.EmployeeId),
            new("locationId", r.LocationId.ToString()),
            new("eodDate", r.EodDate)
        };
        claims.AddRange(r.Roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiry),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
