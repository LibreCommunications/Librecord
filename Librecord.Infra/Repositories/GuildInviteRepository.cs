using Librecord.Domain.Guilds;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class GuildInviteRepository : IGuildInviteRepository
{
    private readonly LibrecordContext _db;

    public GuildInviteRepository(LibrecordContext db)
    {
        _db = db;
    }

    public Task<GuildInvite?> GetByIdAsync(Guid id)
    {
        return _db.GuildInvites
            .Include(i => i.Creator)
            .Include(i => i.Guild)
            .FirstOrDefaultAsync(i => i.Id == id);
    }

    public Task<GuildInvite?> GetByCodeAsync(string code)
    {
        return _db.GuildInvites
            .Include(i => i.Creator)
            .Include(i => i.Guild)
            .FirstOrDefaultAsync(i => i.Code == code);
    }

    public Task<List<GuildInvite>> GetByGuildIdAsync(Guid guildId)
    {
        return _db.GuildInvites
            .Include(i => i.Creator)
            .Where(i => i.GuildId == guildId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();
    }

    public Task AddAsync(GuildInvite invite)
    {
        _db.GuildInvites.Add(invite);
        return Task.CompletedTask;
    }

    public async Task DeleteAsync(Guid id)
    {
        var invite = await _db.GuildInvites.FindAsync(id);
        if (invite != null)
            _db.GuildInvites.Remove(invite);
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}
