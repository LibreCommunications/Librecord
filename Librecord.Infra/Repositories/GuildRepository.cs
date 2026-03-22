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

    public Task<List<Guid>> GetChannelIdsAsync(Guid guildId)
    {
        return _db.GuildChannels
            .Where(c => c.GuildId == guildId)
            .Select(c => c.Id)
            .ToListAsync();
    }

    public Task RemoveMemberAsync(GuildMember member)
    {
        _db.GuildMembers.Remove(member);
        return Task.CompletedTask;
    }

    public Task<GuildBan?> GetBanAsync(Guid guildId, Guid userId)
        => _db.GuildBans.FirstOrDefaultAsync(b => b.GuildId == guildId && b.UserId == userId);

    public Task<List<GuildBan>> GetBansAsync(Guid guildId)
        => _db.GuildBans
            .Where(b => b.GuildId == guildId)
            .Include(b => b.User)
            .Include(b => b.Moderator)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

    public Task AddBanAsync(GuildBan ban)
    {
        _db.GuildBans.Add(ban);
        return Task.CompletedTask;
    }

    public Task RemoveBanAsync(GuildBan ban)
    {
        _db.GuildBans.Remove(ban);
        return Task.CompletedTask;
    }

    public Task RemoveGuildAsync(Guild guild)
    {
        _db.Guilds.Remove(guild);
        return Task.CompletedTask;
    }

    public Task<GuildChannelPermissionOverride?> GetChannelOverrideAsync(
        Guid channelId, Guid permissionId, Guid? roleId, Guid? userId)
        => _db.GuildChannelPermissionOverrides
            .FirstOrDefaultAsync(o =>
                o.ChannelId == channelId &&
                o.PermissionId == permissionId &&
                o.RoleId == roleId &&
                o.UserId == userId);

    public Task AddChannelOverrideAsync(GuildChannelPermissionOverride overrideEntity)
    {
        _db.GuildChannelPermissionOverrides.Add(overrideEntity);
        return Task.CompletedTask;
    }

    public Task RemoveChannelOverrideAsync(GuildChannelPermissionOverride overrideEntity)
    {
        _db.GuildChannelPermissionOverrides.Remove(overrideEntity);
        return Task.CompletedTask;
    }
}