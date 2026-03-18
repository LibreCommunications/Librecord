using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Messaging;

public interface IDirectMessageService
{
    // ---------------------------------------------------------
    // Reads
    // ---------------------------------------------------------
    Task<IReadOnlyList<Message>> GetMessagesAsync(
        Guid channelId,
        Guid userId,
        int limit = 50,
        Guid? beforeMessageId = null);

    // ---------------------------------------------------------
    // Writes
    // ---------------------------------------------------------
    Task<Message> SendMessageAsync(
        Guid channelId,
        Guid userId,
        string content,
        string? clientMessageId = null);

    Task<Message?> EditMessageAsync(
        Guid messageId,
        Guid userId,
        string newContent);

    Task<bool> DeleteMessageAsync(
        Guid messageId,
        Guid userId);
}