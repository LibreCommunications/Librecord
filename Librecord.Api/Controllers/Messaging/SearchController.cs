using System.Security.Claims;
using Librecord.Domain.Security;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("search")]
public class SearchController : ControllerBase
{
    private readonly LibrecordContext _db;
    private readonly IMessageEncryptionService _encryption;

    public SearchController(LibrecordContext db, IMessageEncryptionService encryption)
    {
        _db = db;
        _encryption = encryption;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // SEARCH MESSAGES
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] Guid? channelId = null,
        [FromQuery] Guid? guildId = null,
        [FromQuery] int limit = 25)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("Search query is required.");

        limit = Math.Clamp(limit, 1, 50);

        var query = _db.Messages
            .Include(m => m.User)
            .Include(m => m.DmContext)
            .Include(m => m.GuildContext)
            .AsQueryable();

        if (channelId.HasValue)
        {
            query = query.Where(m =>
                (m.DmContext != null && m.DmContext.ChannelId == channelId.Value) ||
                (m.GuildContext != null && m.GuildContext.ChannelId == channelId.Value));
        }

        if (guildId.HasValue)
        {
            var guildChannelIds = await _db.GuildChannels
                .Where(c => c.GuildId == guildId.Value)
                .Select(c => c.Id)
                .ToListAsync();

            query = query.Where(m =>
                m.GuildContext != null && guildChannelIds.Contains(m.GuildContext.ChannelId));
        }

        var messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit * 3)
            .ToListAsync();

        var results = new List<object>();
        var term = q.ToLowerInvariant();

        foreach (var msg in messages)
        {
            if (msg.Content == null || msg.Content.Length == 0) continue;

            try
            {
                // Get encryption metadata from the context table
                byte[] salt;
                string algorithm;

                if (msg.DmContext != null)
                {
                    salt = msg.DmContext.EncryptionSalt;
                    algorithm = msg.DmContext.EncryptionAlgorithm;
                }
                else if (msg.GuildContext != null)
                {
                    salt = msg.GuildContext.EncryptionSalt;
                    algorithm = msg.GuildContext.EncryptionAlgorithm;
                }
                else continue;

                var plaintext = _encryption.Decrypt(msg.Content, salt, algorithm);
                if (!plaintext.Contains(term, StringComparison.OrdinalIgnoreCase))
                    continue;

                var channelIdResult = msg.DmContext?.ChannelId ?? msg.GuildContext?.ChannelId;

                results.Add(new
                {
                    id = msg.Id,
                    channelId = channelIdResult,
                    content = plaintext,
                    createdAt = msg.CreatedAt,
                    author = new
                    {
                        id = msg.User.Id,
                        username = msg.User.UserName,
                        displayName = msg.User.DisplayName,
                        avatarUrl = msg.User.AvatarUrl
                    }
                });

                if (results.Count >= limit) break;
            }
            catch
            {
                // Skip messages that fail to decrypt
            }
        }

        return Ok(results);
    }
}
