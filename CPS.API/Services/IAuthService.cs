// =============================================================================
// File        : IAuthService.cs
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Service interface for login, logout, and password management.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task LogoutAsync(int userId);
    Task ChangePasswordAsync(int userId, ChangePasswordRequest request);
    Task<UserMeResponse> GetMeAsync(int userId, string eodDate);
}
