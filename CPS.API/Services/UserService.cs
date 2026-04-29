// =============================================================================
// File        : UserService.cs
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : Business logic for user management, location assignment, and password reset.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;
using CPS.API.Exceptions;
using CPS.API.Models;
using CPS.API.Repositories;

namespace CPS.API.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepo;
    private readonly ILocationRepository _locationRepo;
    private readonly IAuditService _audit;

    public UserService(IUserRepository userRepo, ILocationRepository locationRepo, IAuditService audit)
    {
        _userRepo = userRepo;
        _locationRepo = locationRepo;
        _audit = audit;
    }

    public async Task<List<UserDto>> GetAllAsync()
    {
        var users = await _userRepo.GetAllAsync();
        return users.Select(MapToDto).ToList();
    }

    public async Task<UserDto> GetByIdAsync(int userId)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");
        return MapToDto(user);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, int createdBy)
    {
        if (await _userRepo.ExistsEmployeeIdAsync(request.EmployeeID))
            throw new ConflictException($"Employee ID '{request.EmployeeID}' already exists.");

        if (await _userRepo.ExistsUsernameAsync(request.Username))
            throw new ConflictException($"Username '{request.Username}' already exists.");

        if (request.Password.Length < 8)
            throw new ValidationException("Password must be at least 8 characters.");

        if (request.DefaultLocationID.HasValue)
        {
            var loc = await _locationRepo.GetByIdAsync(request.DefaultLocationID.Value);
            if (loc == null) throw new ValidationException("Default location not found.");
        }

        var user = new UserMaster
        {
            EmployeeID = request.EmployeeID.Trim(),
            Username = request.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, 12),
            Email = request.Email?.Trim(),
            DefaultLocationID = request.DefaultLocationID,
            IsActive = true,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        // Save actual role values as-is (no override)

        await _userRepo.CreateAsync(user);
        await _userRepo.SyncUserRolesAsync(user.UserID, request.Roles, request.IsDeveloper);

        await _audit.LogAsync("UserMaster", user.UserID.ToString(), "INSERT", null,
            new { user.EmployeeID, user.Username }, createdBy);

        return MapToDto(user);
    }

    public async Task<UserDto> UpdateAsync(int userId, UpdateUserRequest request, int updatedBy)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");

        if (await _userRepo.ExistsUsernameAsync(request.Username, userId))
            throw new ConflictException($"Username '{request.Username}' already taken.");

        if (await _userRepo.ExistsEmployeeIdAsync(request.EmployeeID, userId))
            throw new ConflictException($"Employee ID '{request.EmployeeID}' already exists for another user.");

        var old = new { user.Username, user.EmployeeID };

        user.Username = request.Username.Trim();
        user.EmployeeID = request.EmployeeID.Trim();
        user.Email = request.Email?.Trim();
        user.DefaultLocationID = request.DefaultLocationID;
        user.UpdatedBy = updatedBy;
        user.UpdatedAt = DateTime.UtcNow;

        // Save actual role values as-is (Admin/Developer don't override individual roles in database)
        // Access control is handled at runtime - Admin/Developer get all permissions regardless of individual role flags

        await _userRepo.UpdateAsync(user);
        await _userRepo.SyncUserRolesAsync(user.UserID, request.Roles, request.IsDeveloper);

        await _audit.LogAsync("UserMaster", userId.ToString(), "UPDATE", old,
            new { user.Username, user.EmployeeID }, updatedBy);

        return MapToDto(user);
    }

    public async Task DeleteAsync(int userId, int deletedBy)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");

        user.IsDeleted = true;
        user.IsActive = false;
        user.UpdatedBy = deletedBy;
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);

        await _audit.LogAsync("UserMaster", userId.ToString(), "DELETE",
            new { user.Username, user.EmployeeID }, null, deletedBy);
    }

    public async Task AssignLocationAsync(int userId, AssignLocationRequest request, int assignedBy)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");

        var location = await _locationRepo.GetByIdAsync(request.LocationID)
            ?? throw new NotFoundException($"Location {request.LocationID} not found.");

        var history = new UserLocationHistory
        {
            UserID = userId,
            LocationID = request.LocationID,
            AssignedDate = DateOnly.FromDateTime(DateTime.Today),
            IsTemporary = request.IsTemporary,
            AssignedBy = assignedBy,
            CreatedAt = DateTime.UtcNow
        };

        await _userRepo.AddLocationHistoryAsync(history);

        if (!request.IsTemporary)
        {
            user.DefaultLocationID = request.LocationID;
            user.UpdatedBy = assignedBy;
            user.UpdatedAt = DateTime.UtcNow;
            await _userRepo.UpdateAsync(user);
        }

        await _audit.LogAsync("UserMaster", userId.ToString(), "UPDATE",
            new { user.DefaultLocationID },
            new { LocationID = request.LocationID, IsTemporary = request.IsTemporary }, assignedBy);
    }

    public async Task SetStatusAsync(int userId, bool isActive, int updatedBy)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");

        user.IsActive = isActive;
        user.UpdatedBy = updatedBy;
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);
    }

    public async Task ResetPasswordAsync(int userId, ResetPasswordRequest request, int updatedBy)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");

        if (request.NewPassword.Length < 8)
            throw new ValidationException("Password must be at least 8 characters.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, 12);
        user.UpdatedBy = updatedBy;
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);

        await _audit.LogAsync("UserMaster", userId.ToString(), "UPDATE",
            null, new { action = "PasswordReset" }, updatedBy);
    }

    public async Task UnlockAsync(int userId, int updatedBy)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new NotFoundException($"User {userId} not found.");

        user.IsLocked = false;
        user.LoginAttempts = 0;
        user.UpdatedBy = updatedBy;
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);
    }

    private static UserDto MapToDto(UserMaster u) => new()
    {
        UserID = u.UserID,
        EmployeeID = u.EmployeeID,
        Username = u.Username,
        Email = u.Email,
        IsActive = u.IsActive,
        IsLocked = u.IsLocked,
        Roles = u.UserRoles.Where(ur => ur.Role != null).Select(ur => ur.Role!.RoleName).ToList(),
        IsDeveloper = u.UserRoles.Any(ur => ur.Role != null && ur.Role.RoleName == "Developer"),
        DefaultLocationID = u.DefaultLocationID,
        DefaultLocationName = u.DefaultLocation?.LocationName,
        CreatedAt = u.CreatedAt?.ToString("yyyy-MM-dd HH:mm:ss")
    };
}
