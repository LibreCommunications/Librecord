using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class RoleRepository : IRoleRepository
{
    private readonly LibrecordContext _db;

    public RoleRepository(LibrecordContext db)
    {
        _db = db;
    }

    // ---------------------------------------------------------
    // GET ROLE (WITH PERMISSIONS)
    // ---------------------------------------------------------
    public Task<GuildRole?> GetRoleAsync(Guid id)
    {
        return _db.GuildRoles
            .Include(r => r.Permissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id);
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
        return Task.CompletedTask;
    }

    public Task DeleteRoleAsync(GuildRole role)
    {
        _db.GuildRoles.Remove(role);
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
    }

    // ---------------------------------------------------------
    // SAVE
    // ---------------------------------------------------------
    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}