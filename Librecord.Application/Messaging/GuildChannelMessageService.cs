using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Guild;

namespace Librecord.Application.Messaging;

public class GuildChannelMessageService : IGuildChannelMessageService
{
    private readonly IGuildMessageRepository _guildMessages;
    private readonly IGuildRealtimeNotifier _realtime;

    public GuildChannelMessageService(
        IGuildMessageRepository guildMessages,
        IGuildRealtimeNotifier realtime)
    {
        _guildMessages = guildMessages;
        _realtime = realtime;
    }

    public Task<Message?> GetMessageAsync(Guid messageId)
    {
        return _guildMessages.GetMessageAsync(messageId);
    }

    public Task<List<Message>> GetChannelMessagesAsync(
        Guid channelId,
        int limit = 50,
        Guid? beforeMessageId = null)
    {
        return _guildMessages.GetChannelMessagesAsync(
            channelId,
            limit,
            beforeMessageId);
    }

    public async Task<Message> CreateMessageAsync(
        Guid channelId,
        Guid userId,
        string content,
        string? clientMessageId = null,
        bool hasAttachments = false,
        bool skipNotification = false)
    {
        if (string.IsNullOrWhiteSpace(content) && !hasAttachments)
            throw new ArgumentException("Message content or attachments required.");

        if (content.Length > Limits.MaxMessageLength)
            throw new ArgumentException($"Message content must not exceed {Limits.MaxMessageLength} characters.");

        var message = new Message
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ContentText = content.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        await _guildMessages.AddMessageAsync(message, channelId);
        await _guildMessages.SaveChangesAsync();

        var hydrated = (await _guildMessages.GetMessageAsync(message.Id))!;

        if (!skipNotification)
        {
            await _realtime.NotifyAsync(new GuildMessageCreated
            {
                ClientMessageId = clientMessageId,
                ChannelId = channelId,
                MessageId = hydrated.Id,
                AuthorId = hydrated.UserId,
                Content = hydrated.ContentText!,
                CreatedAt = hydrated.CreatedAt,
                Author = new GuildAuthorSnapshot
                {
                    Id = hydrated.User.Id,
                    Username = hydrated.User.UserName!,
                    DisplayName = hydrated.User.DisplayName,
                    AvatarUrl = hydrated.User.AvatarUrl
                }
            });
        }

        return hydrated;
    }

    public async Task<Message> EditMessageAsync(
        Guid messageId,
        Guid editorUserId,
        string newContent)
    {
        if (string.IsNullOrWhiteSpace(newContent))
            throw new ArgumentException("Message content required.");

        var message = await _guildMessages.GetMessageAsync(messageId)
                      ?? throw new InvalidOperationException("Message not found.");

        if (message.UserId != editorUserId)
            throw new UnauthorizedAccessException();

        var newPlain = newContent.Trim();

        if (message.ContentText == newPlain)
            return message;

        var edit = new MessageEdit
        {
            Id = Guid.NewGuid(),
            MessageId = message.Id,
            EditorUserId = editorUserId,
            OldContent = message.ContentText,
            EditedAt = DateTime.UtcNow
        };

        message.ContentText = newPlain;
        message.EditedAt = edit.EditedAt;

        await _guildMessages.AddMessageEditAsync(edit);
        await _guildMessages.UpdateMessageAsync(message);
        await _guildMessages.SaveChangesAsync();

        await _realtime.NotifyAsync(new GuildMessageEdited
        {
            ChannelId = message.GuildContext!.ChannelId,
            MessageId = message.Id,
            Content = message.ContentText!,
            EditedAt = message.EditedAt
        });

        return message;
    }

    public async Task DeleteMessageAsync(Guid messageId)
    {
        var message = await _guildMessages.GetMessageAsync(messageId)
                      ?? throw new InvalidOperationException("Message not found.");

        var channelId = message.GuildContext!.ChannelId;

        await _guildMessages.DeleteMessageAsync(messageId);
        await _guildMessages.SaveChangesAsync();

        await _realtime.NotifyAsync(new GuildMessageDeleted
        {
            ChannelId = channelId,
            MessageId = messageId
        });
    }
}
