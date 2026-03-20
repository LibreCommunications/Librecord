using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Messaging;

public interface IGuildChannelMessageService
{
    Task<Message?> GetMessageAsync(Guid messageId);

    Task<List<Message>> GetChannelMessagesAsync(
        Guid channelId,
        int limit = 50,
        Guid? beforeMessageId = null);

    Task<Message> CreateMessageAsync(
        Guid channelId,
        Guid userId,
        string content,
        string? clientMessageId = null,
        bool hasAttachments = false);

    Task<Message> EditMessageAsync(
        Guid messageId,
        Guid editorUserId,
        string newContent);

    Task DeleteMessageAsync(Guid messageId);
}