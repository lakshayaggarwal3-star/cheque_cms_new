// =============================================================================
// File        : AuthDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : DTOs for login, logout, and password change requests/responses.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class LoginRequest
{
    public string LoginId { get; set; } = string.Empty;   // EmployeeID or Username
    public string Password { get; set; } = string.Empty;
    public bool ForceLogin { get; set; } = false;
}

public class LoginResponse
{
    public int UserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public int LocationId { get; set; }
    public string LocationName { get; set; } = string.Empty;
    public string EodDate { get; set; } = string.Empty;
    public bool IsDeveloper { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class UserMeResponse
{
    public int UserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public int LocationId { get; set; }
    public string LocationName { get; set; } = string.Empty;
    public string EodDate { get; set; } = string.Empty;
    public bool IsDeveloper { get; set; }
}
