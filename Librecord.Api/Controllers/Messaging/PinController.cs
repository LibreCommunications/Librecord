using Librecord.Api.Hubs;
using Librecord.Application.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("channels/{channelId:guid}/pins")]
public class PinController : AuthenticatedController
{
    private readonly IPinService _pins;
    private readonly IHubContext<DmHub> _dmHub;
    private readonly IHubContext<GuildHub> _guildHub;

    public PinController(
        IPinService pins,
        IHubContext<DmHub> dmHub,
        IHubContext<GuildHub> guildHub)
    {
        _pins = pins;
        _dmHub = dmHub;
        _guildHub = guildHub;
    }

    [HttpPost("{messageId:guid}")]
    public async Task<IActionResult> Pin(Guid channelId, Guid messageId)
    {
        if (!await _pins.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        var pinned = await _pins.PinMessageAsync(channelId, messageId, UserId);
        if (!pinned) return NotFound("Message not in this channel.");

        var payload = new { channelId, messageId };
        await Task.WhenAll(
            _dmHub.Clients.Group(DmHub.ChannelGroup(channelId)).SendAsync("channel:message:pinned", payload),
            _guildHub.Clients.Group(GuildHub.ChannelGroup(channelId)).SendAsync("channel:message:pinned", payload));

        return Ok();
    }

    [HttpDelete("{messageId:guid}")]
    public async Task<IActionResult> Unpin(Guid channelId, Guid messageId)
    {
        if (!await _pins.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        var unpinned = await _pins.UnpinMessageAsync(channelId, messageId);
        if (!unpinned) return NotFound();

        var payload = new { channelId, messageId };
        await Task.WhenAll(
            _dmHub.Clients.Group(DmHub.ChannelGroup(channelId)).SendAsync("channel:message:unpinned", payload),
            _guildHub.Clients.Group(GuildHub.ChannelGroup(channelId)).SendAsync("channel:message:unpinned", payload));

        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid channelId)
    {
        if (!await _pins.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        var pins = await _pins.GetPinnedMessagesAsync(channelId);

        return Ok(pins.Select(p => new
        {
            messageId = p.MessageId,
            channelId = p.ChannelId,
            content = p.Content,
            createdAt = p.CreatedAt,
            author = new { id = p.Author.Id, username = p.Author.Username, displayName = p.Author.DisplayName },
            pinnedBy = new { id = p.PinnedBy.Id, displayName = p.PinnedBy.DisplayName },
            pinnedAt = p.PinnedAt
        }));
    }
}
