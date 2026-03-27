using Librecord.Domain.Messaging.Common;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Librecord.Infra.Repositories;

public class ReadStateRepository : IReadStateRepository
{
    private readonly LibrecordContext _db;
    private readonly IMemoryCache _cache;

    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(10);

    public ReadStateRepository(LibrecordContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<ChannelReadState?> GetAsync(Guid userId, Guid channelId)
    {
        var key = $"repo:readstate:{userId}:{channelId}";
        if (_cache.TryGetValue(key, out ChannelReadState? cached))
            return cached;

        var result = await _db.ChannelReadStates
            .FirstOrDefaultAsync(r => r.UserId == userId && r.ChannelId == channelId);

        _cache.Set(key, result, CacheTtl);
        return result;
    }

    public Task<List<ChannelReadState>> GetForUserAsync(Guid userId)
    {
        return _db.ChannelReadStates
            .Where(r => r.UserId == userId)
            .ToListAsync();
    }

    public async Task UpsertAsync(Guid userId, Guid channelId, Guid messageId)
    {
        var state = await _db.ChannelReadStates
            .FirstOrDefaultAsync(r => r.UserId == userId && r.ChannelId == channelId);

        if (state == null)
        {
            _db.ChannelReadStates.Add(new ChannelReadState
            {
                UserId = userId,
                ChannelId = channelId,
                LastReadMessageId = messageId,
                LastReadAt = DateTime.UtcNow
            });
        }
        else
        {
            state.LastReadMessageId = messageId;
            state.LastReadAt = DateTime.UtcNow;
        }

        _cache.Remove($"repo:readstate:{userId}:{channelId}");
    }

    public async Task<Dictionary<Guid, int>> GetUnreadCountsAsync(Guid userId, List<Guid> channelIds)
    {
        var result = new Dictionary<Guid, int>();

        var readStates = await _db.ChannelReadStates
            .Where(r => r.UserId == userId && channelIds.Contains(r.ChannelId))
            .ToListAsync();

        var readMap = readStates.ToDictionary(r => r.ChannelId, r => r.LastReadMessageId);

        foreach (var channelId in channelIds)
        {
            var lastRead = readMap.GetValueOrDefault(channelId);

            int count;
            if (lastRead == null)
            {
                var dmCount = await _db.DmChannelMessages
                    .Where(m => m.ChannelId == channelId)
                    .Join(_db.Messages, dm => dm.MessageId, msg => msg.Id, (dm, msg) => msg)
                    .Where(msg => msg.UserId != userId)
                    .CountAsync();

                var guildCount = await _db.GuildChannelMessages
                    .Where(m => m.ChannelId == channelId)
                    .Join(_db.Messages, gm => gm.MessageId, msg => msg.Id, (gm, msg) => msg)
                    .Where(msg => msg.UserId != userId)
                    .CountAsync();

                count = dmCount + guildCount;
            }
            else
            {
                var lastReadMsg = await _db.Messages.FindAsync(lastRead);
                if (lastReadMsg == null) { result[channelId] = 0; continue; }

                var dmCount = await _db.DmChannelMessages
                    .Where(m => m.ChannelId == channelId)
                    .Join(_db.Messages, dm => dm.MessageId, msg => msg.Id, (dm, msg) => msg)
                    .Where(msg => msg.CreatedAt > lastReadMsg.CreatedAt && msg.UserId != userId)
                    .CountAsync();

                var guildCount = await _db.GuildChannelMessages
                    .Where(m => m.ChannelId == channelId)
                    .Join(_db.Messages, gm => gm.MessageId, msg => msg.Id, (gm, msg) => msg)
                    .Where(msg => msg.CreatedAt > lastReadMsg.CreatedAt && msg.UserId != userId)
                    .CountAsync();

                count = dmCount + guildCount;
            }

            result[channelId] = count;
        }

        return result;
    }

    public async Task DeleteByChannelIdAsync(Guid channelId)
    {
        var states = await _db.ChannelReadStates
            .Where(r => r.ChannelId == channelId)
            .ToListAsync();

        _db.ChannelReadStates.RemoveRange(states);
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}
