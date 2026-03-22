using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Messaging;

public interface IThreadService
{
    Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId);
    Task<MessageThread?> CreateThreadAsync(Guid channelId, Guid parentMessageId, string name, Guid creatorId);
    Task<IReadOnlyList<MessageThread>> GetThreadsAsync(Guid channelId);
    Task<(MessageThread? Thread, List<ThreadMessage> Messages)> GetThreadMessagesAsync(
        Guid threadId, Guid channelId, int limit, Guid? beforeMessageId);
    Task<ThreadPostResult?> PostMessageAsync(Guid threadId, Guid channelId, Guid userId, string content);
}

public record ThreadPostResult(Guid MessageId, string Content, DateTime CreatedAt, ThreadPostAuthor Author);
public record ThreadPostAuthor(Guid Id, string? Username, string DisplayName, string? AvatarUrl);
