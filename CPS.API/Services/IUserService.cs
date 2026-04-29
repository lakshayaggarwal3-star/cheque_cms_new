// =============================================================================
// File        : IUserService.cs
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : Service interface for user CRUD and location assignment.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync();
    Task<UserDto> GetByIdAsync(int userId);
    Task<UserDto> CreateAsync(CreateUserRequest request, int createdBy);
    Task<UserDto> UpdateAsync(int userId, UpdateUserRequest request, int updatedBy);
    Task AssignLocationAsync(int userId, AssignLocationRequest request, int assignedBy);
    Task SetStatusAsync(int userId, bool isActive, int updatedBy);
    Task ResetPasswordAsync(int userId, ResetPasswordRequest request, int updatedBy);
    Task UnlockAsync(int userId, int updatedBy);
    Task DeleteAsync(int userId, int deletedBy);
}
