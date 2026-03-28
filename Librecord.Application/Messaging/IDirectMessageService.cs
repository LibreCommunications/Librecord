using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Messaging;

public interface IDirectMessageService
{
    Task<Message?> GetMessageAsync(Guid messageId);

    Task<IReadOnlyList<Message>> GetMessagesAsync(
        Guid channelId,
        Guid userId,
        int limit = 50,
        Guid? beforeMessageId = null);

    Task<Message> SendMessageAsync(
        Guid channelId,
        Guid userId,
        string content,
        string? clientMessageId = null,
        bool hasAttachments = false,
        bool skipNotification = false,
        Guid? replyToMessageId = null);

    Task<Message?> EditMessageAsync(
        Guid messageId,
        Guid userId,
        string newContent);

    Task<bool> DeleteMessageAsync(
        Guid messageId,
        Guid userId);
}