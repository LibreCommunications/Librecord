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
                    _hub.Clients.Group(group).SendAsync(
                        "guild:message:ping",
                        new
                        {
                            channelId = created.ChannelId,
                            messageId = created.MessageId,
                            authorId = created.AuthorId,
                            authorName = created.Author.DisplayName,
                        }),
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
                            ReplyTo = created.ReplyTo,
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

    public Task NotifyMemberRemovedAsync(GuildMemberRemoved evt)
    {
        var tasks = evt.ChannelIds.Select(channelId =>
            _hub.Clients.Group(AppHub.GuildGroup(channelId))
                .SendAsync("guild:member:removed", new
                {
                    guildId = evt.GuildId,
                    userId = evt.UserId,
                    action = evt.Action,
                    reason = evt.Reason,
                }));
        return Task.WhenAll(tasks);
    }

    public Task NotifyGuildUpdatedAsync(GuildUpdated evt)
    {
        var tasks = evt.ChannelIds.Select(channelId =>
            _hub.Clients.Group(AppHub.GuildGroup(channelId))
                .SendAsync("guild:updated", new
                {
                    guildId = evt.GuildId,
                    name = evt.Name,
                    iconUrl = evt.IconUrl,
                }));
        return Task.WhenAll(tasks);
    }

    public Task NotifyGuildDeletedAsync(GuildDeleted evt)
    {
        // Broadcast to every channel group in the guild so all connected members see it
        var tasks = evt.ChannelIds.Select(channelId =>
            _hub.Clients.Group(AppHub.GuildGroup(channelId))
                .SendAsync("guild:deleted", new { guildId = evt.GuildId }));

        return Task.WhenAll(tasks);
    }

    public Task NotifyThreadMessageCreatedAsync(ThreadMessageCreated evt)
    {
        var group = AppHub.GuildGroup(evt.ChannelId);
        return _hub.Clients.Group(group).SendAsync("guild:thread:message:new", new
        {
            channelId = evt.ChannelId,
            threadId = evt.ThreadId,
            messageId = evt.MessageId,
            content = evt.Content,
            createdAt = evt.CreatedAt,
            author = new
            {
                id = evt.Author.Id,
                username = evt.Author.Username,
                displayName = evt.Author.DisplayName,
                avatarUrl = evt.Author.AvatarUrl,
            }
        });
    }
}
