using System.Security.Claims;
using Librecord.Api.Hubs;
using Librecord.Api.Requests;
using Librecord.Application.Guilds;
using Librecord.Application.Interfaces;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("channels")]
[Authorize]
public class ChannelController : AuthenticatedController
{
    private readonly IChannelService _channels;
    private readonly IPermissionService _permissions;
    private readonly IHubContext<AppHub> _hub;
    private readonly IGuildService _guilds;

    public ChannelController(
        IChannelService channels,
        IPermissionService permissions,
        IHubContext<AppHub> hub,
        IGuildService guilds)
    {
        _channels = channels;
        _permissions = permissions;
        _hub = hub;
        _guilds = guilds;
    }
    // ---------------------------------------------------------
    // GET CHANNEL
    // ---------------------------------------------------------
    [HttpGet("{channelId:guid}")]
    public async Task<IActionResult> Get(Guid channelId)
    {
        var channel = await _channels.GetChannelAsync(channelId);
        if (channel == null)
            return NotFound();

        var access = await _permissions.HasChannelPermissionAsync(
            UserId,
            channelId,
            ChannelPermission.ReadMessages);

        if (!access.Allowed)
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new { error = access.Error }
            );

        return Ok(new
        {
            id = channel.Id,
            name = channel.Name,
            type = channel.Type,
            topic = channel.Topic,
            guildId = channel.GuildId,
            parentId = channel.ParentId,
            position = channel.Position
        });
    }

    // ---------------------------------------------------------
    // LIST CHANNELS IN GUILD
    // ---------------------------------------------------------
    [HttpGet("guild/{guildId:guid}")]
    public async Task<IActionResult> ListForGuild(Guid guildId)
    {
        var access = await _permissions.HasGuildPermissionAsync(
            UserId,
            guildId,
            GuildPermission.ReadMessages);

        if (!access.Allowed)
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new { error = access.Error }
            );

        var channels = await _channels.GetGuildChannelsAsync(guildId);
        return Ok(channels.Select(c => new
        {
            id = c.Id,
            name = c.Name,
            type = c.Type,
            parentId = c.ParentId,
            position = c.Position,
            guildId = c.GuildId
        }));
    }

    // ---------------------------------------------------------
    // CREATE CHANNEL
    // ---------------------------------------------------------
    [HttpPost("guild/{guildId:guid}")]
    public async Task<IActionResult> Create(
        Guid guildId,
        [FromBody] CreateChannelRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Channel name required.");

        var access = await _permissions.HasGuildPermissionAsync(
            UserId,
            guildId,
            GuildPermission.ManageChannels);

        if (!access.Allowed)
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new { error = access.Error }
            );

        if (!Enum.IsDefined(typeof(GuildChannelType), dto.Type))
            return BadRequest("Invalid channel type.");

        var channel = new GuildChannel
        {
            Id = Guid.NewGuid(),
            GuildId = guildId,
            Name = dto.Name.Trim(),
            Type = (GuildChannelType)dto.Type,
            Position = dto.Position,
            Topic = dto.Topic,
            CreatedAt = DateTime.UtcNow
        };

        await _channels.CreateChannelAsync(channel);

        // Broadcast channel creation to all existing guild channel groups so
        // connected clients can call JoinChannel for the new channel.
        // We broadcast to every existing channel group because all guild
        // members are already in those groups from OnConnectedAsync.
        var existingChannels = await _channels.GetGuildChannelsAsync(guildId);
        foreach (var ch in existingChannels)
        {
            if (ch.Id == channel.Id) continue; // skip the just-created channel
            await _hub.Clients.Group(AppHub.GuildGroup(ch.Id)).SendAsync(
                "guild:channel:created",
                new
                {
                    channelId = channel.Id,
                    guildId,
                    name = channel.Name,
                    type = (int)channel.Type,
                    position = channel.Position
                });
        }

        return Ok(channel);
    }

    // ---------------------------------------------------------
    // UPDATE CHANNEL
    // ---------------------------------------------------------
    [HttpPut("{channelId:guid}")]
    public async Task<IActionResult> Update(
        Guid channelId,
        [FromBody] UpdateChannelRequest dto)
    {
        var channel = await _channels.GetChannelAsync(channelId);
        if (channel == null)
            return NotFound();

        var access = await _permissions.HasChannelPermissionAsync(
            UserId,
            channelId,
            ChannelPermission.ManageChannels);

        if (!access.Allowed)
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new { error = access.Error }
            );

        if (!string.IsNullOrWhiteSpace(dto.Name))
            channel.Name = dto.Name.Trim();

        channel.Topic = dto.Topic;

        await _channels.UpdateChannelAsync(channel);
        return Ok(channel);
    }

    // ---------------------------------------------------------
    // DELETE CHANNEL
    // ---------------------------------------------------------
    [HttpDelete("{channelId:guid}")]
    public async Task<IActionResult> Delete(Guid channelId)
    {
        var channel = await _channels.GetChannelAsync(channelId);
        if (channel == null)
            return NotFound();

        var access = await _permissions.HasChannelPermissionAsync(
            UserId,
            channelId,
            ChannelPermission.ManageChannels);

        if (!access.Allowed)
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new { error = access.Error }
            );

        await _channels.DeleteChannelAsync(channelId);
        return Ok();
    }
}