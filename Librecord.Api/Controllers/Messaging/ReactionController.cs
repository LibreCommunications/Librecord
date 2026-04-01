using Librecord.Api.Hubs;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("messages/{messageId:guid}/reactions")]
public class ReactionController : AuthenticatedController
{
    private readonly IReactionService _reactions;
    private readonly IPermissionService _permissions;
    private readonly IHubContext<AppHub> _hub;

    public ReactionController(
        IReactionService reactions,
        IPermissionService permissions,
        IHubContext<AppHub> hub)
    {
        _reactions = reactions;
        _permissions = permissions;
        _hub = hub;
    }

    [HttpPut("{emoji}")]
    public async Task<IActionResult> Add(Guid messageId, string emoji)
    {
        // Check AddReactions permission for guild channel messages
        var guildChannelId = await _reactions.GetMessageGuildChannelIdAsync(messageId);
        if (guildChannelId.HasValue)
        {
            var perm = await _permissions.HasChannelPermissionAsync(
                UserId, guildChannelId.Value, ChannelPermission.AddReactions);
            if (!perm.Allowed) return Forbid();
        }

        try
        {
            var reaction = await _reactions.AddReactionAsync(messageId, UserId, emoji);

            var channelId = await _reactions.GetMessageChannelIdAsync(messageId);
            if (channelId.HasValue)
            {
                var payload = new { channelId = channelId.Value, messageId, userId = UserId, emoji = reaction.Emoji };
                await Task.WhenAll(
                    _hub.Clients.Group(AppHub.DmGroup(channelId.Value)).SendAsync("channel:reaction:added", payload),
                    _hub.Clients.Group(AppHub.GuildGroup(channelId.Value)).SendAsync("channel:reaction:added", payload));
            }

            return Ok(new
            {
                messageId = reaction.MessageId,
                userId = reaction.UserId,
                emoji = reaction.Emoji
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{emoji}")]
    public async Task<IActionResult> Remove(Guid messageId, string emoji)
    {
        // Removing your own reaction doesn't need a permission check —
        // only removing others' reactions would, but this endpoint only
        // removes the calling user's reaction.
        await _reactions.RemoveReactionAsync(messageId, UserId, emoji);

        var channelId = await _reactions.GetMessageChannelIdAsync(messageId);
        if (channelId.HasValue)
        {
            var payload = new { channelId = channelId.Value, messageId, userId = UserId, emoji };
            await Task.WhenAll(
                _hub.Clients.Group(AppHub.DmGroup(channelId.Value)).SendAsync("channel:reaction:removed", payload),
                _hub.Clients.Group(AppHub.GuildGroup(channelId.Value)).SendAsync("channel:reaction:removed", payload));
        }

        return Ok();
    }
}
