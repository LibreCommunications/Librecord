using Librecord.Domain.Messaging.Common;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class ReactionRepository : IReactionRepository
{
    private readonly LibrecordContext _db;

    public ReactionRepository(LibrecordContext db)
    {
        _db = db;
    }

    public Task<MessageReaction?> GetAsync(Guid messageId, Guid userId, string emoji)
    {
        return _db.MessageReactions
            .FirstOrDefaultAsync(r =>
                r.MessageId == messageId &&
                r.UserId == userId &&
                r.Emoji == emoji);
    }

    public Task<List<MessageReaction>> GetByMessageAsync(Guid messageId)
    {
        return _db.MessageReactions
            .Where(r => r.MessageId == messageId)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync();
    }

    public Task AddAsync(MessageReaction reaction)
    {
        _db.MessageReactions.Add(reaction);
        return Task.CompletedTask;
    }

    public async Task RemoveAsync(Guid messageId, Guid userId, string emoji)
    {
        var reaction = await GetAsync(messageId, userId, emoji);
        if (reaction != null)
            _db.MessageReactions.Remove(reaction);
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }

    public async Task<Guid?> GetMessageChannelIdAsync(Guid messageId)
    {
        // Check guild context first, then DM context
        var guildCtx = await _db.GuildChannelMessages
            .Where(g => g.MessageId == messageId)
            .Select(g => (Guid?)g.ChannelId)
            .FirstOrDefaultAsync();
        if (guildCtx.HasValue) return guildCtx.Value;

        return await _db.DmChannelMessages
            .Where(d => d.MessageId == messageId)
            .Select(d => (Guid?)d.ChannelId)
            .FirstOrDefaultAsync();
    }
}
