using Librecord.Api.Hubs;
using Librecord.Application.Realtime.Voice;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.RealtimeNotifiers;

public sealed class SignalRVoiceRealtimeNotifier : IVoiceRealtimeNotifier
{
    private readonly IHubContext<AppHub> _hub;

    public SignalRVoiceRealtimeNotifier(IHubContext<AppHub> hub)
    {
        _hub = hub;
    }

    public Task NotifyAsync(VoiceEvent evt)
    {
        var group = evt.GuildId == Guid.Empty
            ? AppHub.DmGroup(evt.ChannelId)
            : AppHub.GuildGroup(evt.ChannelId);

        return evt switch
        {
            VoiceUserJoined joined =>
                _hub.Clients.Group(group).SendAsync(
                    "voice:user:joined",
                    new
                    {
                        channelId = joined.ChannelId,
                        guildId = joined.GuildId,
                        userId = joined.UserId,
                        username = joined.Username,
                        displayName = joined.DisplayName,
                        avatarUrl = joined.AvatarUrl,
                        isMuted = joined.IsMuted,
                        isDeafened = joined.IsDeafened,
                        isCameraOn = joined.IsCameraOn,
                        isScreenSharing = joined.IsScreenSharing
                    }),

            VoiceUserLeft left =>
                _hub.Clients.Group(group).SendAsync(
                    "voice:user:left",
                    new
                    {
                        channelId = left.ChannelId,
                        guildId = left.GuildId,
                        userId = left.UserId
                    }),

            VoiceUserStateChanged changed =>
                _hub.Clients.Group(group).SendAsync(
                    "voice:user:state",
                    new
                    {
                        channelId = changed.ChannelId,
                        guildId = changed.GuildId,
                        userId = changed.UserId,
                        isMuted = changed.IsMuted,
                        isDeafened = changed.IsDeafened,
                        isCameraOn = changed.IsCameraOn,
                        isScreenSharing = changed.IsScreenSharing
                    }),

            _ => Task.CompletedTask
        };
    }
}
