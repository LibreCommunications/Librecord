using System.Security.Claims;
using Librecord.Application.Guilds;
using Librecord.Application.Users;
using Librecord.Application.Voice;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Hubs;

[Authorize]
public class GuildHub : Hub
{
    private readonly IGuildService _guilds;
    private readonly IPresenceService _presence;
    private readonly IVoiceService _voice;
    private readonly ILogger<GuildHub> _logger;

    public GuildHub(
        IGuildService guilds,
        IPresenceService presence,
        IVoiceService voice,
        ILogger<GuildHub> logger)
    {
        _guilds = guilds;
        _presence = presence;
        _voice = voice;
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
            "[GUILD HUB] Connected | ConnectionId={ConnectionId} | UserId={UserId}",
            Context.ConnectionId,
            UserId);

        var guilds = await _guilds.GetGuildsForUserAsync(UserId);

        foreach (var guild in guilds)
        {
            foreach (var channel in guild.Channels)
            {
                var group = ChannelGroup(channel.Id);

                _logger.LogDebug(
                    "[GUILD HUB] Adding {ConnectionId} to group {Group}",
                    Context.ConnectionId,
                    group);

                await Groups.AddToGroupAsync(
                    Context.ConnectionId,
                    group);
            }
        }

        _logger.LogInformation(
            "[GUILD HUB] User {UserId} joined {Count} guild(s)",
            UserId,
            guilds.Count);

        // Broadcast online presence to all guild channels
        foreach (var guild in guilds)
        {
            foreach (var channel in guild.Channels)
            {
                await Clients.OthersInGroup(ChannelGroup(channel.Id)).SendAsync(
                    "guild:user:presence",
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
            "[GUILD HUB] JoinChannel | UserId={UserId} | ChannelId={ChannelId}",
            UserId,
            channelId);

        var canAccess = await _guilds.CanAccessChannelAsync(channelId, UserId);

        if (!canAccess)
        {
            _logger.LogWarning(
                "[GUILD HUB] JoinChannel denied | UserId={UserId} | ChannelId={ChannelId}",
                UserId,
                channelId);

            throw new HubException(
                "You do not have access to this channel.");
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            ChannelGroup(channelId));
    }

    // -----------------------------------------
    // LEAVE CHANNEL
    // -----------------------------------------
    public async Task LeaveChannel(Guid channelId)
    {
        _logger.LogInformation(
            "[GUILD HUB] LeaveChannel | ConnectionId={ConnectionId} | ChannelId={ChannelId}",
            Context.ConnectionId,
            channelId);

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            ChannelGroup(channelId));
    }

    // -----------------------------------------
    // TYPING
    // -----------------------------------------
    public async Task StartTyping(Guid channelId)
    {
        var canAccess = await _guilds.CanAccessChannelAsync(channelId, UserId);
        if (!canAccess) return;

        var group = ChannelGroup(channelId);

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

    // -----------------------------------------
    // VOICE: JOIN
    // -----------------------------------------
    public async Task<VoiceJoinResult> JoinVoiceChannel(Guid channelId)
    {
        _logger.LogInformation(
            "[GUILD HUB] JoinVoiceChannel | UserId={UserId} | ChannelId={ChannelId}",
            UserId, channelId);

        return await _voice.JoinVoiceChannelAsync(channelId, UserId);
    }

    // -----------------------------------------
    // VOICE: LEAVE
    // -----------------------------------------
    public async Task LeaveVoiceChannel()
    {
        _logger.LogInformation(
            "[GUILD HUB] LeaveVoiceChannel | UserId={UserId}",
            UserId);

        await _voice.LeaveVoiceChannelAsync(UserId);
    }

    // -----------------------------------------
    // VOICE: UPDATE STATE
    // -----------------------------------------
    public async Task UpdateVoiceState(VoiceStateUpdateDto update)
    {
        await _voice.UpdateVoiceStateAsync(UserId, update);
    }

    // -----------------------------------------
    // DISCONNECT
    // -----------------------------------------
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
        {
            _logger.LogWarning(
                "[GUILD HUB] Disconnected with error | ConnectionId={ConnectionId} | Error={Error}",
                Context.ConnectionId,
                exception.Message);
        }
        else
        {
            _logger.LogInformation(
                "[GUILD HUB] Disconnected | ConnectionId={ConnectionId} | UserId={UserId}",
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
                "[GUILD HUB] Failed to leave voice on disconnect | UserId={UserId}",
                UserId);
        }

        var guilds = await _guilds.GetGuildsForUserAsync(UserId);
        foreach (var guild in guilds)
        {
            foreach (var channel in guild.Channels)
            {
                await Clients.OthersInGroup(ChannelGroup(channel.Id)).SendAsync(
                    "guild:user:presence",
                    new { userId = UserId, status = "offline" });
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // -----------------------------------------
    // GROUP NAME
    // -----------------------------------------
    internal static string ChannelGroup(Guid channelId)
        => $"guild:{channelId}";
}
