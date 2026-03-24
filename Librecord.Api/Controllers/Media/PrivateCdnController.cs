using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Media;

[ApiController]
[Authorize]
[Route("cdn/private")]
public class PrivateCdnController : AuthenticatedController
{
    private readonly IAttachmentStorageService _storage;
    private readonly IAttachmentAccessRepository _access;

    public PrivateCdnController(
        IAttachmentStorageService storage,
        IAttachmentAccessRepository access)
    {
        _storage = storage;
        _access = access;
    }

    [HttpGet("{**key}")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Get(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest("Missing key");

        if (!await UserCanAccessKeyAsync(key))
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

    private async Task<bool> UserCanAccessKeyAsync(string key)
    {
        var segments = key.Split('/');

        if (segments.Length < 3 || segments[0] != "attachments")
            return false;

        if (!Guid.TryParse(segments[1], out var messageId))
            return false;

        return await _access.CanUserAccessMessageAsync(messageId, UserId);
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
            ".mp3" => "audio/mpeg",
            ".ogg" => "audio/ogg",
            ".wav" => "audio/wav",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream",
        };
    }
}
