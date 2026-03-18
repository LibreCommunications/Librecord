using Librecord.Domain.Guilds;

namespace Librecord.Application.Guilds;

public interface IGuildService
{
    Task<Guild?> GetGuildAsync(Guid guildId);

    Task<List<Guild>> GetGuildsForUserAsync(Guid userId);

    Task<GuildMember?> GetMemberAsync(Guid guildId, Guid userId);

    Task<bool> IsMemberAsync(Guid guildId, Guid userId);

    Task<List<GuildMember>> GetMembersAsync(Guid guildId);

    Task<Guild> CreateGuildAsync(Guid ownerId, string name);

    Task<GuildChannel?> GetChannelAsync(Guid channelId);

    Task<List<GuildChannelPermissionOverride>> GetChannelOverridesAsync(Guid channelId);

    Task<bool> CanAccessChannelAsync(Guid channelId, Guid userId);
}