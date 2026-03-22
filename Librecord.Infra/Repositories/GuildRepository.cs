using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class GuildRepository : IGuildRepository
{
    private readonly LibrecordContext _db;

    public GuildRepository(LibrecordContext db)
    {
        _db = db;
    }

    public Task AddGuildAsync(Guild guild)
    {
        _db.Guilds.Add(guild);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }


    public Task<List<Guild>> GetGuildsForUserAsync(Guid userId)
    {
        return _db.GuildMembers
            .Where(m => m.UserId == userId)
            .Include(m => m.Guild)
                .ThenInclude(g => g.Channels)
            .Select(m => m.Guild)
            .ToListAsync();
    }


    public Task<Guild?> GetGuildAsync(Guid id)
    {
        return _db.Guilds
            .Include(g => g.Roles)
            .ThenInclude(r => r.Permissions)
            .FirstOrDefaultAsync(g => g.Id == id);
    }

    public Task<GuildMember?> GetGuildMemberAsync(Guid guildId, Guid userId)
    {
        return _db.GuildMembers
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.GuildId == guildId && m.UserId == userId);
    }

    public Task<List<GuildMember>> GetGuildMembersAsync(Guid guildId)
    {
        return _db.GuildMembers
            .Where(m => m.GuildId == guildId)
            .Include(m => m.User)
            .Include(m => m.Roles)
                .ThenInclude(r => r.Role)
            .OrderBy(m => m.JoinedAt)
            .ToListAsync();
    }

    public Task<List<Permission>> GetRolePermissionsAsync(Guid roleId)
    {
        return _db.RolePermissions
            .Where(rp => rp.RoleId == roleId)
            .Select(rp => rp.Permission)
            .ToListAsync();
    }

    public Task<List<GuildChannelPermissionOverride>> GetChannelOverridesAsync(Guid channelId)
    {
        return _db.GuildChannelPermissionOverrides
            .Where(o => o.ChannelId == channelId)
            .Include(o => o.Permission)
            .ToListAsync();
    }

    public Task<GuildChannel?> GetChannelAsync(Guid channelId)
    {
        return _db.GuildChannels
            .Include(c => c.Guild)
            .FirstOrDefaultAsync(c => c.Id == channelId);
    }
}