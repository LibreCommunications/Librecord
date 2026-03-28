using Librecord.Application.Realtime.DMs;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;

namespace Librecord.Application.Messaging;

public sealed class DirectMessageService : IDirectMessageService
{
    private readonly IDirectMessageChannelRepository _channels;
    private readonly IDirectMessageRepository _messages;
    private readonly IDmRealtimeNotifier _realtime;
    private readonly IBlockRepository _blocks;

    public DirectMessageService(
        IDirectMessageRepository messages,
        IDirectMessageChannelRepository channels,
        IDmRealtimeNotifier realtime,
        IBlockRepository blocks)
    {
        _messages = messages;
        _channels = channels;
        _realtime = realtime;
        _blocks = blocks;
    }

    public async Task<Message> SendMessageAsync(
        Guid channelId,
        Guid userId,
        string content,
        string? clientMessageId = null,
        bool hasAttachments = false,
        bool skipNotification = false,
        Guid? replyToMessageId = null)
    {
        if (string.IsNullOrWhiteSpace(content) && !hasAttachments)
            throw new ArgumentException("Message content or attachments required.");

        if (content.Length > Limits.MaxMessageLength)
            throw new ArgumentException($"Message content must not exceed {Limits.MaxMessageLength} characters.");

        var channel = await _channels.GetChannelAsync(channelId)
            ?? throw new InvalidOperationException("DM channel not found.");

        if (channel.Members.All(m => m.UserId != userId))
            throw new UnauthorizedAccessException("Not a DM member.");

        var otherMembers = channel.Members
            .Where(m => m.UserId != userId)
            .Select(m => m.UserId)
            .ToList();

        if (otherMembers.Count == 1)
        {
            if (await _blocks.IsEitherBlockedAsync(userId, otherMembers[0]))
                throw new InvalidOperationException("Cannot send messages to this user.");
        }

        var message = new Message
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ContentText = content,
            CreatedAt = DateTime.UtcNow,
            ReplyToMessageId = replyToMessageId,
        };

        await _messages.AddMessageAsync(message, channelId);
        await _messages.SaveChangesAsync();

        // Re-load to hydrate + decrypt
        var hydrated = await _messages.GetMessageAsync(message.Id)
            ?? throw new InvalidOperationException("Message load failed.");

        if (!skipNotification)
        {
            await _realtime.NotifyAsync(new DmMessageCreated
            {
                ClientMessageId = clientMessageId,
                ChannelId = channelId,
                MessageId = hydrated.Id,
                AuthorId = hydrated.UserId,
                Content = hydrated.ContentText!,
                CreatedAt = hydrated.CreatedAt,
                Author = new DmAuthorSnapshot
                {
                    Id = hydrated.User.Id,
                    Username = hydrated.User.UserName!,
                    DisplayName = hydrated.User.DisplayName,
                    AvatarUrl = hydrated.User.AvatarUrl
                },
                ReplyTo = hydrated.ReplyToMessage != null
                    ? new ReplySnapshot
                    {
                        MessageId = hydrated.ReplyToMessage.Id,
                        Content = hydrated.ReplyToMessage.ContentText ?? "",
                        Author = hydrated.ReplyToMessage.User != null ? new ReplyAuthorSnapshot
                        {
                            Id = hydrated.ReplyToMessage.User.Id,
                            Username = hydrated.ReplyToMessage.User.UserName ?? "",
                            DisplayName = hydrated.ReplyToMessage.User.DisplayName,
                            AvatarUrl = hydrated.ReplyToMessage.User.AvatarUrl,
                        } : null,
                    }
                    : null,
            });
        }

        return hydrated;
    }

    public async Task<Message?> GetMessageAsync(Guid messageId)
    {
        return await _messages.GetMessageAsync(messageId);
    }

    public async Task<IReadOnlyList<Message>> GetMessagesAsync(
        Guid channelId,
        Guid userId,
        int limit = 50,
        Guid? before = null)
    {
        var channel = await _channels.GetChannelAsync(channelId);
        if (channel == null)
            return [];

        if (channel.Members.All(m => m.UserId != userId))
            return [];

        return await _messages.GetChannelMessagesAsync(
            channelId,
            limit,
            before);
    }

    public async Task<Message?> EditMessageAsync(
        Guid messageId,
        Guid userId,
        string newContent)
    {
        if (string.IsNullOrWhiteSpace(newContent))
            return null;

        var message = await _messages.GetMessageAsync(messageId);
        if (message == null || message.UserId != userId)
            return null;

        message.ContentText = newContent;
        message.EditedAt = DateTime.UtcNow;

        await _messages.UpdateMessageAsync(message);
        await _messages.SaveChangesAsync();

        await _realtime.NotifyAsync(new DmMessageEdited
        {
            ChannelId = message.DmContext!.ChannelId,
            MessageId = message.Id,
            Content = message.ContentText!,
            EditedAt = message.EditedAt
        });

        return message;
    }

    public async Task<bool> DeleteMessageAsync(
        Guid messageId,
        Guid userId)
    {
        var message = await _messages.GetMessageAsync(messageId);
        if (message == null || message.UserId != userId)
            return false;

        var channelId = message.DmContext!.ChannelId;

        await _messages.DeleteMessageAsync(messageId);
        await _messages.SaveChangesAsync();

        await _realtime.NotifyAsync(new DmMessageDeleted
        {
            ChannelId = channelId,
            MessageId = messageId
        });

        return true;
    }
}
