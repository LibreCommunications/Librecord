using Librecord.Domain.Messaging.Common;

namespace Librecord.Domain.Messaging.Guild;

public interface IGuildMessageRepository
{
    Task<Message?> GetMessageAsync(Guid messageId);

    Task<List<Message>> GetChannelMessagesAsync(
        Guid channelId,
        int limit = 50,
        Guid? beforeMessageId = null);

    Task AddMessageAsync(Message message, Guid channelId);

    Task AddMessageEditAsync(MessageEdit edit);

    Task UpdateMessageAsync(Message message);

    Task DeleteMessageAsync(Guid messageId);

    Task SaveChangesAsync();
}
