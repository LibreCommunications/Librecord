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
    /// Redirects to a presigned MinIO URL (24h expiry) for public assets.
    /// The browser follows the redirect and loads the file directly from MinIO.
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
            var presignedUrl = await _storage.GetPresignedUrl(key, expirySeconds: 86400); // 24h
            return Redirect(presignedUrl);
        }
        catch
        {
            return NotFound();
        }
    }
}
