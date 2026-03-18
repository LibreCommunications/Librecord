using Librecord.Domain.Messaging.Direct;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class DirectMessageChannelRepository : IDirectMessageChannelRepository
{
    private readonly LibrecordContext _db;

    public DirectMessageChannelRepository(LibrecordContext db)
    {
        _db = db;
    }
    

    public Task<DmChannel?> GetChannelAsync(Guid id)
    {
        return _db.DmChannels
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .Include(c => c.Messages)
            .ThenInclude(cm => cm.Message)
            .ThenInclude(m => m.Attachments)
            .Include(c => c.Messages)
            .ThenInclude(cm => cm.Message)
            .ThenInclude(m => m.Reactions)
            .Include(c => c.Messages)
            .ThenInclude(cm => cm.Message)
            .ThenInclude(m => m.Edits)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public Task<List<DmChannel>> GetUserDmChannelsAsync(Guid userId)
    {
        return _db.DmChannels
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .Where(c => c.Members.Any(m => m.UserId == userId))
            .ToListAsync();
    }

    public Task AddChannelAsync(DmChannel channel)
    {
        _db.DmChannels.Add(channel);
        return Task.CompletedTask;
    }

    public Task UpdateChannelAsync(DmChannel channel)
    {
        _db.DmChannels.Update(channel);
        return Task.CompletedTask;
    }

    public Task DeleteChannelAsync(DmChannel channel)
    {
        _db.DmChannels.Remove(channel);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}