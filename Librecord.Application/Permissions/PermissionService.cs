using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;

namespace Librecord.Application.Permissions;

public class PermissionService : IPermissionService
{
    private readonly IGuildRepository _guilds;
    private readonly IPermissionRegistry _registry;

    public PermissionService(
        IGuildRepository guilds,
        IPermissionRegistry registry)
    {
        _guilds = guilds;
        _registry = registry;
    }

    // ---------------------------------------------------------
    // GUILD PERMISSION
    // ---------------------------------------------------------
    public async Task<PermissionResult> HasGuildPermissionAsync(
        Guid userId,
        Guid guildId,
        PermissionCapability required)
    {
        var granted = await GetGrantedGuildPermissionsAsync(userId, guildId);
        if (granted == null)
            return PermissionResult.Deny("User is not a guild member.");

        return granted.Contains(required)
            ? PermissionResult.Allow()
            : PermissionResult.Deny($"Missing guild permission: {required.Key}");
    }

    /// <summary>
    /// Returns all guild-level permissions granted to a user via their roles,
    /// or null if the user is not a guild member. Uses a single batched query
    /// for all role permissions instead of one query per role.
    /// </summary>
    public async Task<HashSet<PermissionCapability>?> GetGrantedGuildPermissionsAsync(
        Guid userId, Guid guildId)
    {
        var member = await _guilds.GetGuildMemberAsync(guildId, userId);
        if (member == null) return null;

        var roleIds = member.Roles.Select(r => r.RoleId);
        var perms = await _guilds.GetRolesPermissionsBatchAsync(roleIds);

        var granted = new HashSet<PermissionCapability>();
        foreach (var perm in perms)
            granted.Add(_registry.Resolve(perm.Name, perm.Type));

        return granted;
    }

    // ---------------------------------------------------------
    // CHANNEL PERMISSION
    // ---------------------------------------------------------
    public async Task<PermissionResult> HasChannelPermissionAsync(
        Guid userId,
        Guid channelId,
        PermissionCapability required)
    {
        var channel = await _guilds.GetChannelAsync(channelId);
        if (channel == null)
            return PermissionResult.Deny("Channel not found.");

        var member = await _guilds.GetGuildMemberAsync(channel.GuildId, userId);
        if (member == null)
            return PermissionResult.Deny("Not a guild member.");

        var overrides = await _guilds.GetChannelOverridesAsync(channelId);

        // -----------------------------------------------------
        // USER OVERRIDES (highest priority)
        // -----------------------------------------------------
        var userOverride = overrides.FirstOrDefault(o =>
            o.UserId == userId &&
            _registry.Resolve(o.Permission.Name, o.Permission.Type)
                .Equals(required));

        if (userOverride?.Allow == true)
            return PermissionResult.Allow();

        if (userOverride?.Allow == false)
            return PermissionResult.Deny("User override denies permission.");

        // -----------------------------------------------------
        // ROLE OVERRIDES
        // -----------------------------------------------------
        foreach (var roleLink in member.Roles)
        {
            var roleOverride = overrides.FirstOrDefault(o =>
                o.RoleId == roleLink.RoleId &&
                _registry.Resolve(o.Permission.Name, o.Permission.Type)
                    .Equals(required));

            if (roleOverride?.Allow == true)
                return PermissionResult.Allow();

            if (roleOverride?.Allow == false)
                return PermissionResult.Deny("Role override denies permission.");
        }

        // -----------------------------------------------------
        // FALL BACK TO GUILD PERMISSIONS (reuse already-fetched member)
        // -----------------------------------------------------
        var roleIds = member.Roles.Select(r => r.RoleId);
        var perms = await _guilds.GetRolesPermissionsBatchAsync(roleIds);

        var granted = new HashSet<PermissionCapability>();
        foreach (var perm in perms)
            granted.Add(_registry.Resolve(perm.Name, perm.Type));

        return granted.Contains(required)
            ? PermissionResult.Allow()
            : PermissionResult.Deny($"Missing guild permission: {required.Key}");
    }

    // ---------------------------------------------------------
    // SET CHANNEL OVERRIDE
    // ---------------------------------------------------------
    public async Task SetChannelOverrideAsync(
        Guid channelId, Guid? roleId, Guid? userId,
        Guid permissionId, bool? allow)
    {
        var existing = await _guilds.GetChannelOverrideAsync(channelId, permissionId, roleId, userId);

        if (allow == null)
        {
            // Remove override (inherit)
            if (existing != null)
            {
                await _guilds.RemoveChannelOverrideAsync(existing);
                await _guilds.SaveChangesAsync();
            }
            return;
        }

        if (existing != null)
        {
            existing.Allow = allow;
        }
        else
        {
            await _guilds.AddChannelOverrideAsync(new Domain.Guilds.GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = channelId,
                RoleId = roleId,
                UserId = userId,
                PermissionId = permissionId,
                Allow = allow,
            });
        }

        await _guilds.SaveChangesAsync();
    }
}