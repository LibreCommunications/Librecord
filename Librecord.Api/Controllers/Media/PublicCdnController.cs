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
    /// Returns a presigned URL for public assets stored in MinIO.
    /// In production, nginx serves these directly from MinIO — this
    /// endpoint is only hit in development or as a fallback.
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
            var url = await _storage.GetPresignedUrl(key, 3600);
            return Redirect(url);
        }
        catch (Exception)
        {
            return NotFound();
        }
    }
}
