using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Librecord.Infra.Repositories;

public class RoleRepository : IRoleRepository
{
    private readonly LibrecordContext _db;
    private readonly IMemoryCache _cache;

    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public RoleRepository(LibrecordContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    // ---------------------------------------------------------
    // GET ROLE (WITH PERMISSIONS)
    // ---------------------------------------------------------
    public async Task<GuildRole?> GetRoleAsync(Guid id)
    {
        var key = $"repo:role:{id}";
        if (_cache.TryGetValue(key, out GuildRole? cached))
            return cached;

        var result = await _db.GuildRoles
            .Include(r => r.Permissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (result != null)
            _cache.Set(key, result, CacheTtl);

        return result;
    }

    // ---------------------------------------------------------
    // CREATE / UPDATE / DELETE ROLE
    // ---------------------------------------------------------
    public Task AddRoleAsync(GuildRole role)
    {
        _db.GuildRoles.Add(role);
        return Task.CompletedTask;
    }

    public Task UpdateRoleAsync(GuildRole role)
    {
        _db.GuildRoles.Update(role);
        _cache.Remove($"repo:role:{role.Id}");
        return Task.CompletedTask;
    }

    public Task DeleteRoleAsync(GuildRole role)
    {
        _db.GuildRoles.Remove(role);
        _cache.Remove($"repo:role:{role.Id}");
        InvalidateRolePermsGeneration();
        return Task.CompletedTask;
    }

    // ---------------------------------------------------------
    // PERMISSIONS
    // ---------------------------------------------------------
    public async Task AddPermissionToRoleAsync(
        Guid roleId,
        Guid permissionId,
        bool allow)
    {
        var exists = await _db.RolePermissions.AnyAsync(rp =>
            rp.RoleId == roleId &&
            rp.PermissionId == permissionId);

        if (exists)
            return;

        _db.RolePermissions.Add(new RolePermission
        {
            RoleId = roleId,
            PermissionId = permissionId,
            Allow = allow
        });

        // Invalidate caches for this role's permissions
        _cache.Remove($"repo:role:{roleId}");
        _cache.Remove($"repo:role-perms-single:{roleId}");
        InvalidateRolePermsGeneration();
    }

    public async Task RemovePermissionFromRoleAsync(
        Guid roleId,
        Guid permissionId)
    {
        var rp = await _db.RolePermissions.FirstOrDefaultAsync(rp =>
            rp.RoleId == roleId &&
            rp.PermissionId == permissionId);

        if (rp != null)
            _db.RolePermissions.Remove(rp);

        // Invalidate caches for this role's permissions
        _cache.Remove($"repo:role:{roleId}");
        _cache.Remove($"repo:role-perms-single:{roleId}");
        InvalidateRolePermsGeneration();
    }

    // ---------------------------------------------------------
    // SAVE
    // ---------------------------------------------------------
    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }

    // ---------------------------------------------------------
    // CACHE HELPERS
    // ---------------------------------------------------------
    private void InvalidateRolePermsGeneration()
    {
        // Bump the generation counter used by GuildRepository's
        // batch role-permissions cache keys
        var gen = _cache.Get<long>("repo:role-perms-gen");
        _cache.Set("repo:role-perms-gen", gen + 1);
    }
}
