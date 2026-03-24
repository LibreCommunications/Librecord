using Librecord.Domain.Messaging.Common;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class MessageSearchRepository : IMessageSearchRepository
{
    private readonly LibrecordContext _db;

    public MessageSearchRepository(LibrecordContext db) => _db = db;

    public async Task<List<Message>> SearchMessagesAsync(Guid? channelId, Guid? guildId, int fetchLimit)
    {
        var query = _db.Messages
            .Include(m => m.User)
            .Include(m => m.DmContext)
            .Include(m => m.GuildContext)
            .AsQueryable();

        if (channelId.HasValue)
        {
            query = query.Where(m =>
                (m.DmContext != null && m.DmContext.ChannelId == channelId.Value) ||
                (m.GuildContext != null && m.GuildContext.ChannelId == channelId.Value));
        }

        if (guildId.HasValue)
        {
            var guildChannelIds = await _db.GuildChannels
                .Where(c => c.GuildId == guildId.Value)
                .Select(c => c.Id)
                .ToListAsync();

            query = query.Where(m =>
                m.GuildContext != null && guildChannelIds.Contains(m.GuildContext.ChannelId));
        }

        return await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(fetchLimit)
            .ToListAsync();
    }
}
