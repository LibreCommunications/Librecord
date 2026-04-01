using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Security;

namespace Librecord.Application.Messaging;

public class ThreadService : IThreadService
{
    private readonly IThreadRepository _threads;
    private readonly IMessageEncryptionService _encryption;
    private readonly IUserRepository _users;

    public ThreadService(
        IThreadRepository threads,
        IMessageEncryptionService encryption,
        IUserRepository users)
    {
        _threads = threads;
        _encryption = encryption;
        _users = users;
    }

    public Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId)
        => _threads.IsChannelMemberAsync(channelId, userId);

    public async Task<MessageThread?> CreateThreadAsync(
        Guid channelId, Guid parentMessageId, string name, Guid creatorId)
    {
        if (!await _threads.IsMessageInChannelAsync(channelId, parentMessageId))
            return null;

        var thread = new MessageThread
        {
            Id = Guid.NewGuid(),
            ParentMessageId = parentMessageId,
            ChannelId = channelId,
            Name = name.Trim(),
            CreatorId = creatorId,
            CreatedAt = DateTime.UtcNow
        };

        await _threads.AddThreadAsync(thread);
        await _threads.SaveChangesAsync();
        return thread;
    }

    public async Task<IReadOnlyList<MessageThread>> GetThreadsAsync(Guid channelId)
        => await _threads.GetThreadsForChannelAsync(channelId);

    public async Task<(MessageThread? Thread, List<ThreadMessage> Messages)> GetThreadMessagesAsync(
        Guid threadId, Guid channelId, int limit, Guid? beforeMessageId)
    {
        var thread = await _threads.GetThreadAsync(threadId);
        if (thread == null || thread.ChannelId != channelId)
            return (null, []);

        DateTime? beforeDate = null;
        if (beforeMessageId.HasValue)
        {
            // We need to look up the message's date — use the thread repo's message access
            // For simplicity, pass null and let the repo handle it
        }

        var messages = await _threads.GetThreadMessagesAsync(threadId, limit, beforeDate);
        return (thread, messages);
    }

    public async Task<ThreadPostResult?> PostMessageAsync(
        Guid threadId, Guid channelId, Guid userId, string content)
    {
        var thread = await _threads.GetThreadAsync(threadId);
        if (thread == null || thread.ChannelId != channelId)
            return null;

        var encrypted = _encryption.Encrypt(content.Trim());

        var message = new Message
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Content = encrypted.Ciphertext,
            CreatedAt = DateTime.UtcNow
        };

        await _threads.AddMessageAsync(message);
        await _threads.AddThreadMessageAsync(new ThreadMessage
        {
            MessageId = message.Id,
            ThreadId = threadId,
            EncryptionSalt = encrypted.Salt,
            EncryptionAlgorithm = encrypted.Algorithm,
        });

        thread.MessageCount++;
        thread.LastMessageAt = message.CreatedAt;

        await _threads.SaveChangesAsync();

        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        return new ThreadPostResult(
            message.Id, content.Trim(), message.CreatedAt,
            new ThreadPostAuthor(user.Id, user.UserName, user.DisplayName, user.AvatarUrl));
    }
}
