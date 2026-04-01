using Librecord.Api.Hubs;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
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
    private readonly IPermissionService _permissions;
    private readonly IGuildRepository _guilds;
    private readonly IHubContext<AppHub> _hub;

    public PinController(
        IPinService pins,
        IPermissionService permissions,
        IGuildRepository guilds,
        IHubContext<AppHub> hub)
    {
        _pins = pins;
        _permissions = permissions;
        _guilds = guilds;
        _hub = hub;
    }

    [HttpPost("{messageId:guid}")]
    public async Task<IActionResult> Pin(Guid channelId, Guid messageId)
    {
        if (!await _pins.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        // Guild channels require ManageMessages permission to pin
        var guildChannel = await _guilds.GetChannelAsync(channelId);
        if (guildChannel != null)
        {
            var perm = await _permissions.HasChannelPermissionAsync(
                UserId, channelId, ChannelPermission.ManageMessages);
            if (!perm.Allowed) return Forbid();
        }

        var pinned = await _pins.PinMessageAsync(channelId, messageId, UserId);
        if (!pinned) return NotFound("Message not in this channel.");

        var payload = new { channelId, messageId };
        await Task.WhenAll(
            _hub.Clients.Group(AppHub.DmGroup(channelId)).SendAsync("channel:message:pinned", payload),
            _hub.Clients.Group(AppHub.GuildGroup(channelId)).SendAsync("channel:message:pinned", payload));

        return Ok();
    }

    [HttpDelete("{messageId:guid}")]
    public async Task<IActionResult> Unpin(Guid channelId, Guid messageId)
    {
        if (!await _pins.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        // Guild channels require ManageMessages permission to unpin
        var guildChannel = await _guilds.GetChannelAsync(channelId);
        if (guildChannel != null)
        {
            var perm = await _permissions.HasChannelPermissionAsync(
                UserId, channelId, ChannelPermission.ManageMessages);
            if (!perm.Allowed) return Forbid();
        }

        var unpinned = await _pins.UnpinMessageAsync(channelId, messageId);
        if (!unpinned) return NotFound();

        var payload = new { channelId, messageId };
        await Task.WhenAll(
            _hub.Clients.Group(AppHub.DmGroup(channelId)).SendAsync("channel:message:unpinned", payload),
            _hub.Clients.Group(AppHub.GuildGroup(channelId)).SendAsync("channel:message:unpinned", payload));

        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid channelId)
    {
        if (!await _pins.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        // Guild channels require ReadMessages permission to view pins
        var guildChannel = await _guilds.GetChannelAsync(channelId);
        if (guildChannel != null)
        {
            var perm = await _permissions.HasChannelPermissionAsync(
                UserId, channelId, ChannelPermission.ReadMessages);
            if (!perm.Allowed) return Forbid();
        }

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
