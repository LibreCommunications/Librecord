using System.Security.Claims;
using Librecord.Application.Messaging;
using Librecord.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Librecord.Api.Hubs;

[Authorize]
public class DmHub : Hub
{
    private readonly IDirectMessageChannelService _channels;
    private readonly IPresenceService _presence;
    private readonly ILogger<DmHub> _logger;

    public DmHub(
        IDirectMessageChannelService channels,
        IPresenceService presence,
        ILogger<DmHub> logger)
    {
        _channels = channels;
        _presence = presence;
        _logger = logger;
    }

    private Guid UserId =>
        Guid.Parse(
            Context.User!
                .FindFirstValue(ClaimTypes.NameIdentifier)!);

    // -----------------------------------------
    // CONNECT
    // -----------------------------------------
    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation(
            "[DM HUB] Connected | ConnectionId={ConnectionId} | UserId={UserId}",
            Context.ConnectionId,
            UserId);

        var channels = await _channels.GetUserChannelsAsync(UserId);

        _logger.LogInformation(
            "[DM HUB] User {UserId} is member of {Count} DM channels",
            UserId,
            channels.Count);

        foreach (var channel in channels)
        {
            var group = ChannelGroup(channel.Id);

            _logger.LogInformation(
                "[DM HUB] Adding connection {ConnectionId} to group {Group}",
                Context.ConnectionId,
                group);

            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                group);
        }

        // Set online presence (only if not invisible)
        var currentPresence = await _presence.GetPresenceAsync(UserId);
        var isInvisible = currentPresence?.Status == Domain.Identity.UserStatus.Offline;

        if (!isInvisible)
        {
            await _presence.SetOnlineAsync(UserId);

            // Broadcast presence to all DM channels
            foreach (var channel in channels)
            {
                await Clients.OthersInGroup(ChannelGroup(channel.Id)).SendAsync(
                    "dm:user:presence",
                    new { userId = UserId, status = "online" });
            }
        }

        await base.OnConnectedAsync();
    }

    // -----------------------------------------
    // JOIN CHANNEL
    // -----------------------------------------
    public async Task JoinChannel(Guid channelId)
    {
        _logger.LogInformation(
            "[DM HUB] JoinChannel requested | UserId={UserId} | ChannelId={ChannelId}",
            UserId,
            channelId);

        var isMember = await _channels.IsMemberAsync(
            channelId,
            UserId);

        if (!isMember)
        {
            _logger.LogWarning(
                "[DM HUB] JoinChannel denied | UserId={UserId} | ChannelId={ChannelId}",
                UserId,
                channelId);

            throw new HubException(
                "You are not a member of this DM channel.");
        }

        var group = ChannelGroup(channelId);

        _logger.LogInformation(
            "[DM HUB] Adding connection {ConnectionId} to group {Group}",
            Context.ConnectionId,
            group);

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            group);
    }

    // -----------------------------------------
    // LEAVE CHANNEL
    // -----------------------------------------
    public async Task LeaveChannel(Guid channelId)
    {
        var group = ChannelGroup(channelId);

        _logger.LogInformation(
            "[DM HUB] Removing connection {ConnectionId} from group {Group}",
            Context.ConnectionId,
            group);

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            group);
    }

    // -----------------------------------------
    // TYPING
    // -----------------------------------------
    public async Task StartTyping(Guid channelId)
    {
        var isMember = await _channels.IsMemberAsync(channelId, UserId);
        if (!isMember) return;

        var group = ChannelGroup(channelId);

        await Clients.OthersInGroup(group).SendAsync(
            "dm:user:typing",
            new
            {
                channelId,
                userId = UserId,
                username = Context.User!.Identity?.Name ?? ""
            });
    }

    // -----------------------------------------
    // DISCONNECT
    // -----------------------------------------
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
        {
            _logger.LogWarning(
                "[DM HUB] Disconnected with error | ConnectionId={ConnectionId} | UserId={UserId} | Error={Error}",
                Context.ConnectionId,
                UserId,
                exception.Message);
        }
        else
        {
            _logger.LogInformation(
                "[DM HUB] Disconnected cleanly | ConnectionId={ConnectionId} | UserId={UserId}",
                Context.ConnectionId,
                UserId);
        }

        // Only broadcast disconnect if user wasn't already invisible
        var currentPresence = await _presence.GetPresenceAsync(UserId);
        var wasInvisible = currentPresence?.Status == Domain.Identity.UserStatus.Offline;

        await _presence.SetOfflineAsync(UserId);

        if (!wasInvisible)
        {
            // Broadcast offline to DM channels
            var channels = await _channels.GetUserChannelsAsync(UserId);
            foreach (var channel in channels)
            {
                await Clients.OthersInGroup(ChannelGroup(channel.Id)).SendAsync(
                    "dm:user:presence",
                    new { userId = UserId, status = "offline" });
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // -----------------------------------------
    // GROUP NAME (CRITICAL)
    // -----------------------------------------
    internal static string ChannelGroup(Guid channelId)
        => $"dm:{channelId}";
}
