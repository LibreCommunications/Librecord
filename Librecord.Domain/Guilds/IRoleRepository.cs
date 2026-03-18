namespace Librecord.Domain.Guilds;

public interface IRoleRepository
{
    // ---------------------------------------------------------
    // ROLE
    // ---------------------------------------------------------
    Task<GuildRole?> GetRoleAsync(Guid id);

    Task AddRoleAsync(GuildRole role);
    Task UpdateRoleAsync(GuildRole role);
    Task DeleteRoleAsync(GuildRole role);

    // ---------------------------------------------------------
    // PERMISSIONS
    // ---------------------------------------------------------
    Task AddPermissionToRoleAsync(
        Guid roleId,
        Guid permissionId,
        bool allow);

    Task RemovePermissionFromRoleAsync(
        Guid roleId,
        Guid permissionId);

    // ---------------------------------------------------------
    // SAVE
    // ---------------------------------------------------------
    Task SaveChangesAsync();
}