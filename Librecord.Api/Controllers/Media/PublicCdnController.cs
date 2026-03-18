using Librecord.Domain.Storage;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Media;

[ApiController]
[Route("cdn/public")]
public class PublicCdnController : ControllerBase
{
    private static readonly string[] AllowedPrefixes =
    {
        "avatars/",
        "guild-icons/",
        "banners/",
        "thumbnails/",
        "emojis/"
    };

    private readonly IAttachmentStorageService _storage;

    public PublicCdnController(IAttachmentStorageService storage)
    {
        _storage = storage;
    }

    /// <summary>
    /// Streams public assets directly from MinIO through the backend.
    /// </summary>
    [HttpGet("{**key}")]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Get(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest("Missing key");

        if (!AllowedPrefixes.Any(p =>
                key.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
            return Forbid();

        try
        {
            var stream = await _storage.DownloadAsync(key);
            var contentType = GetContentType(key);
            return File(stream, contentType);
        }
        catch
        {
            return NotFound();
        }
    }

    private static string GetContentType(string key)
    {
        var ext = Path.GetExtension(key).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            _ => "application/octet-stream",
        };
    }
}
