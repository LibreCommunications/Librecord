using Librecord.Domain.Guilds;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Librecord.Infra.Repositories;

public class ChannelRepository : IChannelRepository
{
    private readonly LibrecordContext _db;
    private readonly IMemoryCache _cache;

    public ChannelRepository(LibrecordContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public Task<GuildChannel?> GetChannelAsync(Guid id)
    {
        return _db.GuildChannels
            .Include(c => c.Guild)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public Task<List<GuildChannel>> GetGuildChannelsAsync(Guid guildId)
    {
        return _db.GuildChannels
            .Where(c => c.GuildId == guildId)
            .OrderBy(c => c.Position)
            .ToListAsync();
    }

    public void AddChannel(GuildChannel channel)
    {
        _db.GuildChannels.Add(channel);
    }

    public void UpdateChannel(GuildChannel channel)
    {
        _db.GuildChannels.Update(channel);
    }

    public void DeleteChannel(GuildChannel channel)
    {
        _db.GuildChannels.Remove(channel);
    }

    public async Task SaveChangesAsync()
    {
        // Invalidate guilds-for-user cache when channels change
        // (GetGuildsForUserAsync includes channels via ThenInclude)
        foreach (var entry in _db.ChangeTracker.Entries<GuildChannel>())
        {
            if (entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            {
                _cache.Remove($"repo:channel:{entry.Entity.Id}");
                var gen = _cache.Get<long>("repo:guilds-gen");
                _cache.Set("repo:guilds-gen", gen + 1);
                break; // One bump is enough
            }
        }

        await _db.SaveChangesAsync();
    }
}
