using Librecord.Domain.Permissions;

namespace Librecord.Domain.Guilds;

public interface IGuildRepository
{
    Task<Guild?> GetGuildAsync(Guid id);

    Task<List<Guild>> GetGuildsForUserAsync(Guid userId);

    Task<GuildMember?> GetGuildMemberAsync(Guid guildId, Guid userId);
    Task<List<GuildMember>> GetGuildMembersAsync(Guid guildId);

    Task AddGuildAsync(Guild guild);

    Task<List<Permission>> GetRolePermissionsAsync(Guid roleId);

    Task<List<GuildChannelPermissionOverride>> GetChannelOverridesAsync(Guid channelId);

    Task<GuildChannel?> GetChannelAsync(Guid channelId);
    Task<List<Guid>> GetChannelIdsAsync(Guid guildId);

    // Member mutations
    Task RemoveMemberAsync(GuildMember member);

    // Ban CRUD
    Task<GuildBan?> GetBanAsync(Guid guildId, Guid userId);
    Task<List<GuildBan>> GetBansAsync(Guid guildId);
    Task AddBanAsync(GuildBan ban);
    Task RemoveBanAsync(GuildBan ban);

    // Guild mutations
    Task RemoveGuildAsync(Guild guild);

    // Channel permission override mutations
    Task<GuildChannelPermissionOverride?> GetChannelOverrideAsync(
        Guid channelId, Guid permissionId, Guid? roleId, Guid? userId);
    Task AddChannelOverrideAsync(GuildChannelPermissionOverride overrideEntity);
    Task RemoveChannelOverrideAsync(GuildChannelPermissionOverride overrideEntity);

    Task SaveChangesAsync();
}