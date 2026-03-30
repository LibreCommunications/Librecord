using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Security;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class ThreadRepository : IThreadRepository
{
    private readonly LibrecordContext _db;
    private readonly IMessageEncryptionService _encryption;

    public ThreadRepository(LibrecordContext db, IMessageEncryptionService encryption)
    {
        _db = db;
        _encryption = encryption;
    }

    public Task<MessageThread?> GetThreadAsync(Guid threadId)
        => _db.Set<MessageThread>().FindAsync(threadId).AsTask();

    public Task<List<MessageThread>> GetThreadsForChannelAsync(Guid channelId)
        => _db.Set<MessageThread>()
            .Where(t => t.ChannelId == channelId)
            .Include(t => t.Creator)
            .OrderByDescending(t => t.LastMessageAt ?? t.CreatedAt)
            .ToListAsync();

    public async Task<List<ThreadMessage>> GetThreadMessagesAsync(Guid threadId, int limit, DateTime? beforeDate)
    {
        var query = _db.Set<ThreadMessage>()
            .Where(tm => tm.ThreadId == threadId)
            .Include(tm => tm.Message).ThenInclude(m => m.User)
            .OrderByDescending(tm => tm.Message.CreatedAt)
            .AsQueryable();

        if (beforeDate.HasValue)
            query = query.Where(tm => tm.Message.CreatedAt < beforeDate.Value);

        var results = await query.Take(limit).ToListAsync();

        foreach (var tm in results)
        {
            if (tm.EncryptionSalt.Length > 0)
            {
                tm.Message.ContentText = _encryption.Decrypt(
                    tm.Message.Content,
                    tm.EncryptionSalt,
                    tm.EncryptionAlgorithm);
            }
        }

        return results;
    }

    public Task AddThreadAsync(MessageThread thread)
    {
        _db.Set<MessageThread>().Add(thread);
        return Task.CompletedTask;
    }

    public Task AddMessageAsync(Message message)
    {
        _db.Messages.Add(message);
        return Task.CompletedTask;
    }

    public Task AddThreadMessageAsync(ThreadMessage threadMessage)
    {
        _db.Set<ThreadMessage>().Add(threadMessage);
        return Task.CompletedTask;
    }

    public async Task<bool> IsMessageInChannelAsync(Guid channelId, Guid messageId)
        => await _db.DmChannelMessages.AnyAsync(m => m.ChannelId == channelId && m.MessageId == messageId)
        || await _db.GuildChannelMessages.AnyAsync(m => m.ChannelId == channelId && m.MessageId == messageId);

    public async Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId)
        => await _db.DmChannelMembers.AnyAsync(m => m.ChannelId == channelId && m.UserId == userId)
        || await _db.GuildChannels.AnyAsync(c => c.Id == channelId && c.Guild.Members.Any(m => m.UserId == userId));

    public Task SaveChangesAsync() => _db.SaveChangesAsync();
}
