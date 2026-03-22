using System.Security.Claims;
using Librecord.Domain.Storage;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Api.Controllers.Media;

[ApiController]
[Authorize]
[Route("cdn/private")]
public class PrivateCdnController : AuthenticatedController
{
    private readonly IAttachmentStorageService _storage;
    private readonly LibrecordContext _db;

    public PrivateCdnController(
        IAttachmentStorageService storage,
        LibrecordContext db)
    {
        _storage = storage;
        _db = db;
    }
    /// <summary>
    /// Validates access then streams the file directly from MinIO through the backend.
    /// </summary>
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

    private async Task<bool> UserCanAccessKeyAsync(string key)
    {
        var segments = key.Split('/');

        // Expected: ["attachments", "{messageId}", "{file}"]
        if (segments.Length < 3 || segments[0] != "attachments")
            return false;

        if (!Guid.TryParse(segments[1], out var messageId))
            return false;

        var userId = UserId;

        // Check if this message belongs to a DM channel the user is a member of
        var dmAccess = await _db.DmChannelMessages
            .Where(dcm => dcm.MessageId == messageId)
            .Select(dcm => dcm.Channel.Members.Any(m => m.UserId == userId))
            .FirstOrDefaultAsync();

        if (dmAccess)
            return true;

        // Check if this message belongs to a guild channel the user has access to
        var guildChannelId = await _db.GuildChannelMessages
            .Where(gcm => gcm.MessageId == messageId)
            .Select(gcm => (Guid?)gcm.ChannelId)
            .FirstOrDefaultAsync();

        if (guildChannelId == null)
            return false;

        // Verify user is a member of the guild that owns this channel
        var guildId = await _db.GuildChannels
            .Where(gc => gc.Id == guildChannelId)
            .Select(gc => gc.GuildId)
            .FirstOrDefaultAsync();

        return await _db.GuildMembers
            .AnyAsync(gm => gm.GuildId == guildId && gm.UserId == userId);
    }
}
