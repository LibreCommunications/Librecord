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

        // User overrides take highest priority
        var userOverride = overrides.FirstOrDefault(o =>
            o.UserId == userId &&
            _registry.Resolve(o.Permission.Name, o.Permission.Type)
                .Equals(required));

        if (userOverride?.Allow == true)
            return PermissionResult.Allow();

        if (userOverride?.Allow == false)
            return PermissionResult.Deny("User override denies permission.");

        // Role overrides next
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

        // Fall back to guild-level permissions
        var roleIds = member.Roles.Select(r => r.RoleId);
        var perms = await _guilds.GetRolesPermissionsBatchAsync(roleIds);

        var granted = new HashSet<PermissionCapability>();
        foreach (var perm in perms)
            granted.Add(_registry.Resolve(perm.Name, perm.Type));

        return granted.Contains(required)
            ? PermissionResult.Allow()
            : PermissionResult.Deny($"Missing guild permission: {required.Key}");
    }

    public async Task<HashSet<PermissionCapability>> GetGrantedChannelPermissionsAsync(
        Guid userId, Guid channelId)
    {
        var granted = new HashSet<PermissionCapability>();

        var channel = await _guilds.GetChannelAsync(channelId);
        if (channel == null) return granted;

        var member = await _guilds.GetGuildMemberAsync(channel.GuildId, userId);
        if (member == null) return granted;

        var overrides = await _guilds.GetChannelOverridesAsync(channelId);
        var roleIds = member.Roles.Select(r => r.RoleId).ToHashSet();
        var rolePerms = await _guilds.GetRolesPermissionsBatchAsync(roleIds);

        var guildGranted = new HashSet<PermissionCapability>();
        foreach (var perm in rolePerms)
            guildGranted.Add(_registry.Resolve(perm.Name, perm.Type));

        var channelPerms = KnownPermissions.All
            .Where(p => p.Type == "Channel")
            .Select(p => p.Perm);

        foreach (var perm in channelPerms)
        {
            // User override takes priority
            var userOverride = overrides.FirstOrDefault(o =>
                o.UserId == userId &&
                _registry.Resolve(o.Permission.Name, o.Permission.Type).Equals(perm));

            if (userOverride?.Allow == true) { granted.Add(perm); continue; }
            if (userOverride?.Allow == false) continue;

            // Role overrides
            var roleAllowed = false;
            var roleDenied = false;
            foreach (var roleLink in member.Roles)
            {
                var ro = overrides.FirstOrDefault(o =>
                    o.RoleId == roleLink.RoleId &&
                    _registry.Resolve(o.Permission.Name, o.Permission.Type).Equals(perm));
                if (ro?.Allow == true) roleAllowed = true;
                if (ro?.Allow == false) roleDenied = true;
            }
            if (roleAllowed) { granted.Add(perm); continue; }
            if (roleDenied) continue;

            // Fall back to guild-level
            if (guildGranted.Contains(perm)) granted.Add(perm);
        }

        return granted;
    }

    public async Task SetChannelOverrideAsync(
        Guid channelId, Guid? roleId, Guid? userId,
        Guid permissionId, bool? allow)
    {
        var existing = await _guilds.GetChannelOverrideAsync(channelId, permissionId, roleId, userId);

        if (allow == null)
        {
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
            await _guilds.AddChannelOverrideAsync(new GuildChannelPermissionOverride
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
