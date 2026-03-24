namespace Librecord.Domain.Messaging.Common;

public interface IThreadRepository
{
    Task<MessageThread?> GetThreadAsync(Guid threadId);
    Task<List<MessageThread>> GetThreadsForChannelAsync(Guid channelId);
    Task<List<ThreadMessage>> GetThreadMessagesAsync(Guid threadId, int limit, DateTime? beforeDate);
    Task AddThreadAsync(MessageThread thread);
    Task AddMessageAsync(Message message);
    Task AddThreadMessageAsync(ThreadMessage threadMessage);
    Task<bool> IsMessageInChannelAsync(Guid channelId, Guid messageId);
    Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId);
    Task SaveChangesAsync();
}
