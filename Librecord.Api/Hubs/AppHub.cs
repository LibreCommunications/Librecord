using System.Security.Claims;
using Librecord.Application.Guilds;
using Librecord.Application.Messaging;
using Librecord.Application.Users;
using Librecord.Application.Voice;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Hubs;

[Authorize]
public class AppHub : Hub
{
    private readonly IDirectMessageChannelService _channels;
    private readonly IGuildService _guilds;
    private readonly IPresenceService _presence;
    private readonly IVoiceService _voice;
    private readonly IConnectionTracker _connections;
    private readonly ILogger<AppHub> _logger;

    public AppHub(
        IDirectMessageChannelService channels,
        IGuildService guilds,
        IPresenceService presence,
        IVoiceService voice,
        IConnectionTracker connections,
        ILogger<AppHub> logger)
    {
        _channels = channels;
        _guilds = guilds;
        _presence = presence;
        _voice = voice;
        _connections = connections;
        _logger = logger;
    }

    private Guid UserId =>
        Guid.Parse(
            Context.User!
                .FindFirstValue(ClaimTypes.NameIdentifier)!);

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation(
            "[APP HUB] Connected | ConnectionId={ConnectionId} | UserId={UserId}",
            Context.ConnectionId,
            UserId);

        var dmChannels = await _channels.GetUserChannelsAsync(UserId);

        _logger.LogInformation(
            "[APP HUB] User {UserId} is member of {Count} DM channels",
            UserId,
            dmChannels.Count);

        await Task.WhenAll(dmChannels.Select(channel =>
            Groups.AddToGroupAsync(Context.ConnectionId, DmGroup(channel.Id))));

        var guilds = await _guilds.GetGuildsForUserAsync(UserId);
        var allGuildChannelIds = guilds.SelectMany(g => (g.Channels ?? []).Select(c => c.Id)).ToList();

        await Task.WhenAll(allGuildChannelIds.Select(channelId =>
            Groups.AddToGroupAsync(Context.ConnectionId, GuildGroup(channelId))));

        _logger.LogInformation(
            "[APP HUB] User {UserId} joined {GuildCount} guild(s), {ChannelCount} guild channel(s)",
            UserId, guilds.Count, allGuildChannelIds.Count);

        _connections.Connect(UserId);

        var currentPresence = await _presence.GetPresenceAsync(UserId);
        var isInvisible = currentPresence?.Status == Domain.Identity.UserStatus.Invisible;

        if (!isInvisible)
        {
            var broadcastStatus = currentPresence?.Status switch
            {
                Domain.Identity.UserStatus.Idle => "idle",
                Domain.Identity.UserStatus.DoNotDisturb => "donotdisturb",
                _ => "online"
            };

            var presencePayload = new { userId = UserId, status = broadcastStatus };

            await Task.WhenAll(dmChannels.Select(channel =>
                Clients.OthersInGroup(DmGroup(channel.Id)).SendAsync("dm:user:presence", presencePayload)));

            await Task.WhenAll(allGuildChannelIds.Select(channelId =>
                Clients.OthersInGroup(GuildGroup(channelId)).SendAsync("guild:user:presence", presencePayload)));
        }

        await base.OnConnectedAsync();
    }

    public async Task JoinDmChannel(Guid channelId)
    {
        _logger.LogInformation(
            "[APP HUB] JoinDmChannel requested | UserId={UserId} | ChannelId={ChannelId}",
            UserId,
            channelId);

        var isMember = await _channels.IsMemberAsync(
            channelId,
            UserId);

        if (!isMember)
        {
            _logger.LogWarning(
                "[APP HUB] JoinDmChannel denied | UserId={UserId} | ChannelId={ChannelId}",
                UserId,
                channelId);

            throw new HubException(
                "You are not a member of this DM channel.");
        }

        var group = DmGroup(channelId);

        _logger.LogInformation(
            "[APP HUB] Adding connection {ConnectionId} to group {Group}",
            Context.ConnectionId,
            group);

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            group);
    }

    public async Task LeaveDmChannel(Guid channelId)
    {
        var group = DmGroup(channelId);

        _logger.LogInformation(
            "[APP HUB] Removing connection {ConnectionId} from group {Group}",
            Context.ConnectionId,
            group);

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            group);
    }

    public async Task JoinGuildChannel(Guid channelId)
    {
        _logger.LogInformation(
            "[APP HUB] JoinGuildChannel | UserId={UserId} | ChannelId={ChannelId}",
            UserId,
            channelId);

        var canAccess = await _guilds.CanAccessChannelAsync(channelId, UserId);

        if (!canAccess)
        {
            _logger.LogWarning(
                "[APP HUB] JoinGuildChannel denied | UserId={UserId} | ChannelId={ChannelId}",
                UserId,
                channelId);

            throw new HubException(
                "You do not have access to this channel.");
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            GuildGroup(channelId));
    }

    public async Task LeaveGuildChannel(Guid channelId)
    {
        _logger.LogInformation(
            "[APP HUB] LeaveGuildChannel | ConnectionId={ConnectionId} | ChannelId={ChannelId}",
            Context.ConnectionId,
            channelId);

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            GuildGroup(channelId));
    }

    public async Task DmStartTyping(Guid channelId)
    {
        var isMember = await _channels.IsMemberAsync(channelId, UserId);
        if (!isMember) return;

        // Ensure this connection is in the channel's SignalR group
        // (may not be if the DM was created after this connection started)
        await Groups.AddToGroupAsync(Context.ConnectionId, DmGroup(channelId));

        var group = DmGroup(channelId);

        await Clients.OthersInGroup(group).SendAsync(
            "dm:user:typing",
            new
            {
                channelId,
                userId = UserId,
                username = Context.User!.Identity?.Name ?? "",
                displayName = Context.User!.FindFirst("displayName")?.Value ?? Context.User!.Identity?.Name ?? ""
            });
    }

    public async Task DmStopTyping(Guid channelId)
    {
        var isMember = await _channels.IsMemberAsync(channelId, UserId);
        if (!isMember) return;

        await Clients.OthersInGroup(DmGroup(channelId)).SendAsync(
            "dm:user:stop-typing",
            new { channelId, userId = UserId });
    }

    public async Task GuildStartTyping(Guid channelId)
    {
        var canAccess = await _guilds.CanAccessChannelAsync(channelId, UserId);
        if (!canAccess) return;

        // Ensure this connection is in the channel's SignalR group
        await Groups.AddToGroupAsync(Context.ConnectionId, GuildGroup(channelId));

        var group = GuildGroup(channelId);

        await Clients.OthersInGroup(group).SendAsync(
            "guild:user:typing",
            new
            {
                channelId,
                userId = UserId,
                username = Context.User!.Identity?.Name ?? "",
                displayName = Context.User!.FindFirst("displayName")?.Value ?? Context.User!.Identity?.Name ?? ""
            });
    }

    public async Task GuildStopTyping(Guid channelId)
    {
        var canAccess = await _guilds.CanAccessChannelAsync(channelId, UserId);
        if (!canAccess) return;

        await Clients.OthersInGroup(GuildGroup(channelId)).SendAsync(
            "guild:user:stop-typing",
            new { channelId, userId = UserId });
    }

    public async Task<VoiceJoinResult> JoinVoiceChannel(Guid channelId)
    {
        _logger.LogInformation(
            "[APP HUB] JoinVoiceChannel | UserId={UserId} | ChannelId={ChannelId}",
            UserId, channelId);

        // Ensure this connection is in the channel's SignalR group
        // (may not be if the channel was created after this connection started)
        await Groups.AddToGroupAsync(Context.ConnectionId, GuildGroup(channelId));

        return await _voice.JoinVoiceChannelAsync(channelId, UserId);
    }

    public async Task LeaveVoiceChannel()
    {
        _logger.LogInformation(
            "[APP HUB] LeaveVoiceChannel | UserId={UserId}",
            UserId);

        await _voice.LeaveVoiceChannelAsync(UserId);
    }

    public async Task UpdateVoiceState(VoiceStateUpdateDto update)
    {
        await _voice.UpdateVoiceStateAsync(UserId, update);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
        {
            _logger.LogWarning(
                "[APP HUB] Disconnected with error | ConnectionId={ConnectionId} | UserId={UserId} | Error={Error}",
                Context.ConnectionId,
                UserId,
                exception.Message);
        }
        else
        {
            _logger.LogInformation(
                "[APP HUB] Disconnected cleanly | ConnectionId={ConnectionId} | UserId={UserId}",
                Context.ConnectionId,
                UserId);
        }

        try
        {
            await _voice.LeaveVoiceChannelAsync(UserId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "[APP HUB] Failed to leave voice on disconnect | UserId={UserId}",
                UserId);
        }

        _connections.Disconnect(UserId);

        // Only broadcast offline if user has no remaining connections and isn't invisible
        if (!_connections.IsOnline(UserId))
        {
            var currentPresence = await _presence.GetPresenceAsync(UserId);
            var wasInvisible = currentPresence?.Status == Domain.Identity.UserStatus.Invisible;

            if (!wasInvisible)
            {
                var offlinePayload = new { userId = UserId, status = "offline" };

                var dmChannels = await _channels.GetUserChannelsAsync(UserId);
                await Task.WhenAll(dmChannels.Select(channel =>
                    Clients.OthersInGroup(DmGroup(channel.Id)).SendAsync("dm:user:presence", offlinePayload)));

                var guilds = await _guilds.GetGuildsForUserAsync(UserId);
                var offlineChannelIds = guilds.SelectMany(g => (g.Channels ?? []).Select(c => c.Id)).ToList();
                await Task.WhenAll(offlineChannelIds.Select(chId =>
                    Clients.OthersInGroup(GuildGroup(chId)).SendAsync("guild:user:presence", offlinePayload)));
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    internal static string DmGroup(Guid channelId)
        => $"dm:{channelId}";

    internal static string GuildGroup(Guid channelId)
        => $"guild:{channelId}";
}
