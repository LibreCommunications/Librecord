using Librecord.Api.Hubs;
using Librecord.Api.TransportDtos.Guild;
using Librecord.Application.Realtime.Guild;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.RealtimeNotifiers;

public sealed class SignalRGuildRealtimeNotifier : IGuildRealtimeNotifier
{
    private readonly IHubContext<AppHub> _hub;

    public SignalRGuildRealtimeNotifier(IHubContext<AppHub> hub)
    {
        _hub = hub;
    }

    public Task NotifyAsync(GuildMessageEvent evt)
    {
        var group = AppHub.GuildGroup(evt.ChannelId);

        return evt switch
        {
            GuildMessageCreated created =>
                Task.WhenAll(
                    // Lightweight ping for unread badges + notifications
                    _hub.Clients.Group(group).SendAsync(
                        "guild:message:ping",
                        new
                        {
                            channelId = created.ChannelId,
                            messageId = created.MessageId,
                            authorId = created.AuthorId,
                            authorName = created.Author.DisplayName,
                        }),
                    // Full payload for active channel view
                    _hub.Clients.Group(group).SendAsync(
                        "guild:message:new",
                        new GuildRealtimeMessageCreatedTransport
                        {
                            ChannelId = created.ChannelId,
                            MessageId = created.MessageId,
                            Content = created.Content,
                            CreatedAt = created.CreatedAt,
                            Author = created.Author,
                            ClientMessageId = created.ClientMessageId,
                            Attachments = created.Attachments
                        })
                ),

            GuildMessageEdited edited =>
                _hub.Clients.Group(group).SendAsync(
                    "guild:message:edited",
                    new GuildRealtimeMessageEditedTransport
                    {
                        ChannelId = edited.ChannelId,
                        MessageId = edited.MessageId,
                        Content = edited.Content,
                        EditedAt = edited.EditedAt
                    }),

            GuildMessageDeleted deleted =>
                _hub.Clients.Group(group).SendAsync(
                    "guild:message:deleted",
                    new GuildRealtimeMessageDeletedTransport
                    {
                        ChannelId = deleted.ChannelId,
                        MessageId = deleted.MessageId
                    }),

            _ => Task.CompletedTask
        };
    }

    public Task NotifyGuildDeletedAsync(GuildDeleted evt)
    {
        // Broadcast to every channel group in the guild so all connected members see it
        var tasks = evt.ChannelIds.Select(channelId =>
            _hub.Clients.Group(AppHub.GuildGroup(channelId))
                .SendAsync("guild:deleted", new { guildId = evt.GuildId }));

        return Task.WhenAll(tasks);
    }
}
