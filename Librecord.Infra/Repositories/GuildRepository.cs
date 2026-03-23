using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Librecord.Infra.Repositories;

public class GuildRepository : IGuildRepository
{
    private readonly LibrecordContext _db;
    private readonly IMemoryCache _cache;

    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public GuildRepository(LibrecordContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public Task AddGuildAsync(Guild guild)
    {
        _db.Guilds.Add(guild);
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync()
    {
        // Detect modified entities and invalidate relevant caches
        InvalidateCachesFromChangeTracker();
        await _db.SaveChangesAsync();
    }

    // ─── CACHED READS ────────────────────────────────────

    public async Task<List<Guild>> GetGuildsForUserAsync(Guid userId)
    {
        var gen = _cache.Get<long>("repo:guilds-gen");
        var key = $"repo:guilds-for-user:v{gen}:{userId}";
        if (_cache.TryGetValue(key, out List<Guild>? cached))
            return cached!;

        var result = await _db.GuildMembers
            .Where(m => m.UserId == userId)
            .Include(m => m.Guild)
                .ThenInclude(g => g.Channels)
            .Select(m => m.Guild)
            .ToListAsync();

        _cache.Set(key, result, CacheTtl);
        return result;
    }

    public async Task<GuildMember?> GetGuildMemberAsync(Guid guildId, Guid userId)
    {
        var key = $"repo:member:{guildId}:{userId}";
        if (_cache.TryGetValue(key, out GuildMember? cached))
            return cached;

        var result = await _db.GuildMembers
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.GuildId == guildId && m.UserId == userId);

        if (result != null)
            _cache.Set(key, result, CacheTtl);

        return result;
    }

    public async Task<List<Permission>> GetRolesPermissionsBatchAsync(IEnumerable<Guid> roleIds)
    {
        var ids = roleIds.ToList();
        var gen = _cache.Get<long>("repo:role-perms-gen");
        var key = $"repo:role-perms:v{gen}:{string.Join(",", ids.OrderBy(i => i))}";
        if (_cache.TryGetValue(key, out List<Permission>? cached))
            return cached!;

        var result = await _db.RolePermissions
            .Where(rp => ids.Contains(rp.RoleId))
            .Select(rp => rp.Permission)
            .Distinct()
            .ToListAsync();

        _cache.Set(key, result, CacheTtl);
        return result;
    }

    public async Task<List<Permission>> GetRolePermissionsAsync(Guid roleId)
    {
        var key = $"repo:role-perms-single:{roleId}";
        if (_cache.TryGetValue(key, out List<Permission>? cached))
            return cached!;

        var result = await _db.RolePermissions
            .Where(rp => rp.RoleId == roleId)
            .Select(rp => rp.Permission)
            .ToListAsync();

        _cache.Set(key, result, CacheTtl);
        return result;
    }

    public async Task<List<GuildChannelPermissionOverride>> GetChannelOverridesAsync(Guid channelId)
    {
        var key = $"repo:chan-overrides:{channelId}";
        if (_cache.TryGetValue(key, out List<GuildChannelPermissionOverride>? cached))
            return cached!;

        var result = await _db.GuildChannelPermissionOverrides
            .Where(o => o.ChannelId == channelId)
            .Include(o => o.Permission)
            .ToListAsync();

        _cache.Set(key, result, CacheTtl);
        return result;
    }

    public async Task<GuildChannel?> GetChannelAsync(Guid channelId)
    {
        var key = $"repo:channel:{channelId}";
        if (_cache.TryGetValue(key, out GuildChannel? cached))
            return cached;

        var result = await _db.GuildChannels
            .Include(c => c.Guild)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (result != null)
            _cache.Set(key, result, CacheTtl);

        return result;
    }

    // ─── NON-CACHED READS ────────────────────────────────

    public Task<Guild?> GetGuildAsync(Guid id)
    {
        return _db.Guilds
            .Include(g => g.Roles)
            .ThenInclude(r => r.Permissions)
            .FirstOrDefaultAsync(g => g.Id == id);
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

    public Task<List<Guid>> GetChannelIdsAsync(Guid guildId)
    {
        return _db.GuildChannels
            .Where(c => c.GuildId == guildId)
            .Select(c => c.Id)
            .ToListAsync();
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

    public Task<GuildChannelPermissionOverride?> GetChannelOverrideAsync(
        Guid channelId, Guid permissionId, Guid? roleId, Guid? userId)
        => _db.GuildChannelPermissionOverrides
            .FirstOrDefaultAsync(o =>
                o.ChannelId == channelId &&
                o.PermissionId == permissionId &&
                o.RoleId == roleId &&
                o.UserId == userId);

    // ─── MUTATIONS (with cache invalidation) ─────────────

    public Task RemoveMemberAsync(GuildMember member)
    {
        _db.GuildMembers.Remove(member);
        _cache.Remove($"repo:member:{member.GuildId}:{member.UserId}");
        InvalidateGuildsForUserGen();
        return Task.CompletedTask;
    }

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

    public Task AddChannelOverrideAsync(GuildChannelPermissionOverride overrideEntity)
    {
        _db.GuildChannelPermissionOverrides.Add(overrideEntity);
        _cache.Remove($"repo:chan-overrides:{overrideEntity.ChannelId}");
        return Task.CompletedTask;
    }

    public Task RemoveChannelOverrideAsync(GuildChannelPermissionOverride overrideEntity)
    {
        _db.GuildChannelPermissionOverrides.Remove(overrideEntity);
        _cache.Remove($"repo:chan-overrides:{overrideEntity.ChannelId}");
        return Task.CompletedTask;
    }

    // ─── CHANGE TRACKER CACHE INVALIDATION ───────────────

    /// <summary>
    /// Scans the EF change tracker for modified/added/deleted entities
    /// that affect cached data and evicts the relevant cache keys.
    /// Called automatically before SaveChangesAsync.
    /// </summary>
    private void InvalidateCachesFromChangeTracker()
    {
        foreach (var entry in _db.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
                continue;

            switch (entry.Entity)
            {
                case GuildMemberRole mr:
                    // Role assigned/removed from member — invalidate member + role perms
                    _cache.Remove($"repo:member:{mr.GuildId}:{mr.UserId}");
                    break;

                case GuildMember m:
                    _cache.Remove($"repo:member:{m.GuildId}:{m.UserId}");
                    InvalidateGuildsForUserGen();
                    break;

                case RolePermission rp:
                    // Role permission changed — invalidate single + batch caches
                    _cache.Remove($"repo:role-perms-single:{rp.RoleId}");
                    // Can't target batch keys precisely, so evict all batch keys
                    // by using a prefix pattern. IMemoryCache doesn't support this,
                    // so we invalidate via a generation counter instead.
                    InvalidateAllRolePermsBatch();
                    break;

                case GuildChannelPermissionOverride ov:
                    _cache.Remove($"repo:chan-overrides:{ov.ChannelId}");
                    break;

                case GuildChannel ch:
                    _cache.Remove($"repo:channel:{ch.Id}");
                    // Channel added/removed changes the guilds-for-user result
                    InvalidateGuildsForUserGen();
                    break;
            }
        }
    }

    /// <summary>
    /// Increments a generation counter that makes all batch role-permission
    /// cache keys stale. We prefix batch keys with the generation number
    /// so changing it effectively invalidates all of them.
    /// </summary>
    private void InvalidateAllRolePermsBatch()
    {
        var gen = _cache.Get<long>("repo:role-perms-gen");
        _cache.Set("repo:role-perms-gen", gen + 1);
    }

    private void InvalidateGuildsForUserGen()
    {
        var gen = _cache.Get<long>("repo:guilds-gen");
        _cache.Set("repo:guilds-gen", gen + 1);
    }
}
