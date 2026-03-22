using System.Security.Claims;
using Librecord.Api.Dtos.Messages;
using Librecord.Api.Hubs;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Security;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("channels/{channelId:guid}/pins")]
public class PinController : ControllerBase
{
    private readonly LibrecordContext _db;
    private readonly IHubContext<DmHub> _dmHub;
    private readonly IHubContext<GuildHub> _guildHub;
    private readonly IMessageEncryptionService _encryption;

    public PinController(
        LibrecordContext db,
        IHubContext<DmHub> dmHub,
        IHubContext<GuildHub> guildHub,
        IMessageEncryptionService encryption)
    {
        _db = db;
        _dmHub = dmHub;
        _guildHub = guildHub;
        _encryption = encryption;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // PIN MESSAGE
    // ---------------------------------------------------------
    [HttpPost("{messageId:guid}")]
    public async Task<IActionResult> Pin(Guid channelId, Guid messageId)
    {
        var existing = await _db.PinnedMessages
            .FirstOrDefaultAsync(p => p.ChannelId == channelId && p.MessageId == messageId);

        if (existing != null) return Ok();

        // Verify message belongs to channel
        var inChannel = await _db.DmChannelMessages
            .AnyAsync(m => m.ChannelId == channelId && m.MessageId == messageId)
            || await _db.GuildChannelMessages
            .AnyAsync(m => m.ChannelId == channelId && m.MessageId == messageId);

        if (!inChannel) return NotFound("Message not in this channel.");

        _db.PinnedMessages.Add(new PinnedMessage
        {
            ChannelId = channelId,
            MessageId = messageId,
            PinnedById = UserId,
            PinnedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var payload = new { channelId, messageId };
        await Task.WhenAll(
            _dmHub.Clients.Group(DmHub.ChannelGroup(channelId))
                .SendAsync("channel:message:pinned", payload),
            _guildHub.Clients.Group(GuildHub.ChannelGroup(channelId))
                .SendAsync("channel:message:pinned", payload)
        );

        return Ok();
    }

    // ---------------------------------------------------------
    // UNPIN MESSAGE
    // ---------------------------------------------------------
    [HttpDelete("{messageId:guid}")]
    public async Task<IActionResult> Unpin(Guid channelId, Guid messageId)
    {
        var pin = await _db.PinnedMessages
            .FirstOrDefaultAsync(p => p.ChannelId == channelId && p.MessageId == messageId);

        if (pin == null) return NotFound();

        _db.PinnedMessages.Remove(pin);
        await _db.SaveChangesAsync();

        var payload = new { channelId, messageId };
        await Task.WhenAll(
            _dmHub.Clients.Group(DmHub.ChannelGroup(channelId))
                .SendAsync("channel:message:unpinned", payload),
            _guildHub.Clients.Group(GuildHub.ChannelGroup(channelId))
                .SendAsync("channel:message:unpinned", payload)
        );

        return Ok();
    }

    // ---------------------------------------------------------
    // LIST PINNED MESSAGES
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> List(Guid channelId)
    {
        var pins = await _db.PinnedMessages
            .Where(p => p.ChannelId == channelId)
            .Include(p => p.Message)
                .ThenInclude(m => m.User)
            .Include(p => p.Message)
                .ThenInclude(m => m.DmContext)
            .Include(p => p.Message)
                .ThenInclude(m => m.GuildContext)
            .Include(p => p.PinnedBy)
            .OrderByDescending(p => p.PinnedAt)
            .ToListAsync();

        return Ok(pins.Select(p =>
        {
            // Decrypt message content using whichever context is available
            string? content = null;
            if (p.Message.DmContext != null)
            {
                content = _encryption.Decrypt(
                    p.Message.Content,
                    p.Message.DmContext.EncryptionSalt,
                    p.Message.DmContext.EncryptionAlgorithm);
            }
            else if (p.Message.GuildContext != null)
            {
                content = _encryption.Decrypt(
                    p.Message.Content,
                    p.Message.GuildContext.EncryptionSalt,
                    p.Message.GuildContext.EncryptionAlgorithm);
            }

            return new
            {
                messageId = p.MessageId,
                channelId = p.ChannelId,
                content,
                createdAt = p.Message.CreatedAt,
                author = new
                {
                    id = p.Message.User.Id,
                    username = p.Message.User.UserName,
                    displayName = p.Message.User.DisplayName
                },
                pinnedBy = new
                {
                    id = p.PinnedBy.Id,
                    displayName = p.PinnedBy.DisplayName
                },
                pinnedAt = p.PinnedAt
            };
        }));
    }
}
