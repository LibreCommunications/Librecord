using Librecord.Application.Interfaces;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;

namespace Librecord.Application.Guilds;

public class GuildService : IGuildService
{
    private readonly IGuildRepository _guilds;
    private readonly IPermissionService _permissions;

    public GuildService(
        IGuildRepository guilds,
        IPermissionService permissions)
    {
        _guilds = guilds;
        _permissions = permissions;
    }

    public async Task<Guild> CreateGuildAsync(Guid ownerId, string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Guild name is required.");

        // ---------------------------------------------------------
        // GUILD
        // ---------------------------------------------------------
        var guild = new Guild
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        // ---------------------------------------------------------
        // ROLES
        // ---------------------------------------------------------
        var everyoneRole = new GuildRole
        {
            Id = Guid.NewGuid(),
            GuildId = guild.Id,
            Name = "@everyone",
            Position = 0
        };

        var ownerRole = new GuildRole
        {
            Id = Guid.NewGuid(),
            GuildId = guild.Id,
            Name = "Owner",
            Position = 1
        };

        // -----------------------------------------
        // @EVERYONE → BASIC PERMISSIONS
        // -----------------------------------------
        var everyonePerms = new[]
        {
            PermissionIds.GuildViewGuild,
            PermissionIds.GuildReadMessages,
            PermissionIds.GuildInviteMembers,
            PermissionIds.ChannelViewChannel,
            PermissionIds.ChannelReadMessages,
            PermissionIds.ChannelSendMessages,
            PermissionIds.ChannelSendAttachments,
            PermissionIds.ChannelAddReactions,
        };

        foreach (var permId in everyonePerms)
            everyoneRole.Permissions.Add(new RolePermission
            {
                RoleId = everyoneRole.Id,
                PermissionId = permId,
                Allow = true
            });

        // -----------------------------------------
        // OWNER → ALL PERMISSIONS
        // -----------------------------------------
        foreach (var perm in KnownPermissions.All)
            ownerRole.Permissions.Add(new RolePermission
            {
                RoleId = ownerRole.Id,
                PermissionId = perm.Id,
                Allow = true
            });

        // -----------------------------------------
        // ADD ROLES TO GUILD
        // -----------------------------------------
        guild.Roles.Add(everyoneRole);
        guild.Roles.Add(ownerRole);


        // ---------------------------------------------------------
        // OWNER MEMBERSHIP
        // ---------------------------------------------------------
        guild.Members.Add(new GuildMember
        {
            UserId = ownerId,
            GuildId = guild.Id,
            JoinedAt = DateTime.UtcNow,
            Roles =
            {
                new GuildMemberRole
                {
                    UserId = ownerId,
                    GuildId = guild.Id,
                    RoleId = ownerRole.Id
                }
            }
        });

        // ---------------------------------------------------------
        // PERSIST
        // ---------------------------------------------------------
        await _guilds.AddGuildAsync(guild);
        await _guilds.SaveChangesAsync();

        return guild;
    }


    // ---------------------------------------------------------
    // GUILD / MEMBER
    // ---------------------------------------------------------
    public Task<Guild?> GetGuildAsync(Guid guildId)
    {
        return _guilds.GetGuildAsync(guildId);
    }

    public Task<List<Guild>> GetGuildsForUserAsync(Guid userId)
    {
        return _guilds.GetGuildsForUserAsync(userId);
    }

    public Task<GuildMember?> GetMemberAsync(Guid guildId, Guid userId)
    {
        return _guilds.GetGuildMemberAsync(guildId, userId);
    }

    public async Task<bool> IsMemberAsync(Guid guildId, Guid userId)
    {
        return await _guilds.GetGuildMemberAsync(guildId, userId) != null;
    }

    public Task<List<GuildMember>> GetMembersAsync(Guid guildId)
    {
        return _guilds.GetGuildMembersAsync(guildId);
    }

    // ---------------------------------------------------------
    // CHANNEL
    // ---------------------------------------------------------
    public Task<GuildChannel?> GetChannelAsync(Guid channelId)
    {
        return _guilds.GetChannelAsync(channelId);
    }

    public Task<List<GuildChannelPermissionOverride>> GetChannelOverridesAsync(Guid channelId)
    {
        return _guilds.GetChannelOverridesAsync(channelId);
    }

    // ---------------------------------------------------------
    // ACCESS CHECK (DELEGATED)
    // ---------------------------------------------------------
    public async Task<bool> CanAccessChannelAsync(Guid channelId, Guid userId)
    {
        var result = await _permissions.HasChannelPermissionAsync(
            userId,
            channelId,
            ChannelPermission.ReadMessages);

        return result.Allowed;
    }
}