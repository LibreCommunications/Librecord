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

    Task SaveChangesAsync();
}