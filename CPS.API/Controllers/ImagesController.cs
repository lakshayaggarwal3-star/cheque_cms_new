// =============================================================================
// File        : ImagesController.cs
// Project     : CPS — Cheque Processing System
// Module      : Image Storage
// Description : Authenticated image serving endpoint with path traversal protection.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CPS.API.Controllers;

[ApiController]
[Authorize]
public class ImagesController : ControllerBase
{
    private readonly IImageStorageConfig _imageConfig;
    private readonly ILogger<ImagesController> _logger;

    public ImagesController(IImageStorageConfig imageConfig, ILogger<ImagesController> logger)
    {
        _imageConfig = imageConfig;
        _logger = logger;
    }

    [HttpGet("/api/images/{*relativePath}")]
    public IActionResult GetImage(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            return BadRequest();

        // Sanitize: reject path traversal
        if (relativePath.Contains("..") || Path.IsPathRooted(relativePath))
        {
            _logger.LogWarning("Path traversal attempt: {Path}", relativePath);
            return BadRequest();
        }

        var basePath = _imageConfig.BasePath;
        var fullPath = Path.GetFullPath(Path.Combine(basePath, relativePath));

        // Verify path stays within base
        if (!fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Path traversal rejected: {Path}", relativePath);
            return BadRequest();
        }

        if (!System.IO.File.Exists(fullPath))
            return NotFound();

        return PhysicalFile(fullPath, "image/jpeg");
    }
}
