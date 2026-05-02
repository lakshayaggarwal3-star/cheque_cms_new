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
using SixLabors.ImageSharp;

namespace CPS.API.Controllers;

[ApiController]
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
        // Manual Auth Check to support Redirects for direct browser access
        if (!User.Identity?.IsAuthenticated ?? true)
        {
            var accept = Request.Headers["Accept"].ToString();
            if (accept.Contains("text/html"))
            {
                // Direct browser access — redirect to login
                var returnUrl = Uri.EscapeDataString(Request.Path + Request.QueryString);
                return Redirect($"/login?returnUrl={returnUrl}");
            }
            return Unauthorized();
        }

        // Role check
        var authorizedRoles = new[] { "Scanner", "Mobile Scanner", "Maker", "Checker", "Admin", "Developer", "Image Viewer" };
        if (!authorizedRoles.Any(r => User.IsInRole(r)))
        {
            return Forbid();
        }

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

        // Log access for audit
        var userId = User.FindFirst("userId")?.Value;
        _logger.LogInformation("Image Accessed: {Path} by UserId={UserId}", relativePath, userId);

        // Security headers: Prevent caching of sensitive cheque data
        Response.Headers.Append("Cache-Control", "no-store, no-cache, must-revalidate");
        Response.Headers.Append("Pragma", "no-cache");

        var extension = Path.GetExtension(fullPath).ToLowerInvariant();
        if (extension == ".tif" || extension == ".tiff")
        {
            try
            {
                using var image = SixLabors.ImageSharp.Image.Load(fullPath);
                var ms = new MemoryStream();
                image.SaveAsJpeg(ms);
                ms.Position = 0;
                return File(ms, "image/jpeg");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error converting TIFF to JPEG for {Path}", relativePath);
                // Fallback: try to serve the raw file anyway, though browser likely won't show it
                return PhysicalFile(fullPath, "image/tiff");
            }
        }

        var contentType = extension switch
        {
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "image/jpeg"
        };

        return PhysicalFile(fullPath, contentType);
    }
}
