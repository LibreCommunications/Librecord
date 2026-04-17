using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Librecord.Api.Controllers.Media;

[ApiController]
[Authorize]
[Route("cdn/private")]
[EnableRateLimiting("cdn")]
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
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Client)]
    public async Task<IActionResult> Get(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest("Missing key");

        if (!await UserCanAccessKeyAsync(key))
            return Forbid();

        try
        {
            var url = await _storage.GetPresignedUrl(key, 600);
            return Redirect(url);
        }
        catch (Exception)
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
}
