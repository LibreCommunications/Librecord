using Librecord.Api.Hubs;
using Librecord.Application.Messaging;
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
    private readonly IHubContext<DmHub> _dmHub;
    private readonly IHubContext<GuildHub> _guildHub;

    public ReactionController(
        IReactionService reactions,
        IHubContext<DmHub> dmHub,
        IHubContext<GuildHub> guildHub)
    {
        _reactions = reactions;
        _dmHub = dmHub;
        _guildHub = guildHub;
    }

    // ---------------------------------------------------------
    // ADD REACTION
    // ---------------------------------------------------------
    [HttpPut("{emoji}")]
    public async Task<IActionResult> Add(Guid messageId, string emoji)
    {
        try
        {
            var reaction = await _reactions.AddReactionAsync(messageId, UserId, emoji);

            var channelId = await _reactions.GetMessageChannelIdAsync(messageId);
            if (channelId.HasValue)
            {
                var payload = new { channelId = channelId.Value, messageId, userId = UserId, emoji = reaction.Emoji };
                await Task.WhenAll(
                    _dmHub.Clients.Group(DmHub.ChannelGroup(channelId.Value)).SendAsync("channel:reaction:added", payload),
                    _guildHub.Clients.Group(GuildHub.ChannelGroup(channelId.Value)).SendAsync("channel:reaction:added", payload));
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

    // ---------------------------------------------------------
    // REMOVE REACTION
    // ---------------------------------------------------------
    [HttpDelete("{emoji}")]
    public async Task<IActionResult> Remove(Guid messageId, string emoji)
    {
        await _reactions.RemoveReactionAsync(messageId, UserId, emoji);

        var channelId = await _reactions.GetMessageChannelIdAsync(messageId);
        if (channelId.HasValue)
        {
            var payload = new { channelId = channelId.Value, messageId, userId = UserId, emoji };
            await Task.WhenAll(
                _dmHub.Clients.Group(DmHub.ChannelGroup(channelId.Value)).SendAsync("channel:reaction:removed", payload),
                _guildHub.Clients.Group(GuildHub.ChannelGroup(channelId.Value)).SendAsync("channel:reaction:removed", payload));
        }

        return Ok();
    }
}
