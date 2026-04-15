// =============================================================================
// File        : ApiResponse.cs
// Project     : CPS — Cheque Processing System
// Module      : Shared
// Description : Standard API response envelope used by all endpoints.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.DTOs;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }
    public string? ErrorCode { get; set; }
    public List<object>? Details { get; set; }

    public static ApiResponse<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiResponse<T> Fail(string errorCode, string message, List<object>? details = null) =>
        new() { Success = false, ErrorCode = errorCode, Message = message, Details = details };
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
