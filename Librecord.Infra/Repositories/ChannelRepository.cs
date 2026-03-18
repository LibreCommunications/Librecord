using Librecord.Domain.Guilds;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class ChannelRepository : IChannelRepository
{
    private readonly LibrecordContext _db;

    public ChannelRepository(LibrecordContext db)
    {
        _db = db;
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


    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}