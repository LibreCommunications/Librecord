using Librecord.Domain.Messaging.Common;

namespace Librecord.Domain.Messaging.Direct;

public interface IDirectMessageRepository
{
    Task<Message?> GetMessageAsync(Guid messageId);

    Task<List<Message>> GetChannelMessagesAsync(
        Guid channelId,
        int limit = 50,
        Guid? beforeMessageId = null);

    Task AddMessageAsync(
        Message message,
        Guid channelId);

    Task UpdateMessageAsync(Message message);

    Task DeleteMessageAsync(Guid messageId);

    Task SaveChangesAsync();
}
