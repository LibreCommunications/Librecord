using Librecord.Api.Dtos.Messages;
using Librecord.Api.Hubs;
using Librecord.Api.TransportDtos.Dm;
using Librecord.Application.Realtime.DMs;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.RealtimeNotifiers;

public sealed class SignalRDmRealtimeNotifier : IDmRealtimeNotifier
{
    private readonly IHubContext<AppHub> _hub;

    public SignalRDmRealtimeNotifier(IHubContext<AppHub> hub)
    {
        _hub = hub;
    }

    public Task NotifyAsync(DmMessageEvent evt)
    {
        var group = AppHub.DmGroup(evt.ChannelId);

        return evt switch
        {
            DmMessageCreated created =>
                Task.WhenAll(
                    // Lightweight ping for unread badges + notifications
                    _hub.Clients.Group(group).SendAsync(
                        "dm:message:ping",
                        new
                        {
                            channelId = created.ChannelId,
                            messageId = created.MessageId,
                            authorId = created.AuthorId,
                            authorName = created.Author.DisplayName,
                        }),
                    // Full payload for active channel view
                    _hub.Clients.Group(group).SendAsync(
                        "dm:message:new",
                        new DmRealtimeMessageCreatedTransport
                        {
                            ChannelId = created.ChannelId,
                            MessageId = created.MessageId,
                            Content = created.Content,
                            CreatedAt = created.CreatedAt,
                            Author = created.Author,

                            Attachments = created.Attachments
                                .Select(MessageAttachmentDto.From)
                                .ToList(),

                            Reactions = created.Reactions
                                .Select(MessageReactionDto.From)
                                .ToList(),

                            Edits = created.Edits
                                .Select(MessageEditDto.From)
                                .ToList(),

                            ClientMessageId = created.ClientMessageId
                        })
                ),


            DmMessageEdited edited =>
                _hub.Clients.Group(group).SendAsync(
                    "dm:message:edited",
                    new DmRealtimeMessageEditedTransport
                    {
                        ChannelId = edited.ChannelId,
                        MessageId = edited.MessageId,
                        Content = edited.Content,
                        EditedAt = edited.EditedAt ?? DateTime.UtcNow
                    }),

            DmMessageDeleted deleted =>
                _hub.Clients.Group(group).SendAsync(
                    "dm:message:deleted",
                    new DmRealtimeMessageDeletedTransport
                    {
                        ChannelId = deleted.ChannelId,
                        MessageId = deleted.MessageId
                    }),

            DmReadStateUpdated readState =>
                _hub.Clients.Group(group).SendAsync(
                    "dm:readstate:updated",
                    new DmRealtimeReadStateUpdatedTransport
                    {
                        ChannelId = readState.ChannelId,
                        MessageId = readState.MessageId,
                        UserId = readState.UserId,
                        ReadAt = readState.ReadAt
                    }),

            _ => Task.CompletedTask
        };
    }
}