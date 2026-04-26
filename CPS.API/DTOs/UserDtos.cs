// =============================================================================
// File        : UserDtos.cs
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : DTOs for user CRUD and location assignment operations.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class CreateUserRequest
{
    public string EmployeeID { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Email { get; set; }
    public int? DefaultLocationID { get; set; }
    public List<string> Roles { get; set; } = new();
    public bool IsDeveloper { get; set; }
}

public class UpdateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public int? DefaultLocationID { get; set; }
    public List<string> Roles { get; set; } = new();
    public bool IsDeveloper { get; set; }
}

public class AssignLocationRequest
{
    public int LocationID { get; set; }
    public bool IsTemporary { get; set; } = false;
}

public class ResetPasswordRequest
{
    public string NewPassword { get; set; } = string.Empty;
}

public class UserDto
{
    public int UserID { get; set; }
    public string EmployeeID { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool IsActive { get; set; }
    public bool IsLocked { get; set; }
    public List<string> Roles { get; set; } = new();
    public bool IsDeveloper { get; set; }
    public int? DefaultLocationID { get; set; }
    public string? DefaultLocationName { get; set; }
    public string? CreatedAt { get; set; }
}

public class UpsertSettingRequest
{
    public string Value { get; set; } = string.Empty;
}
