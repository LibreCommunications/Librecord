using Librecord.Domain.Guilds;

namespace Librecord.Application.Guilds;

public interface IGuildInviteService
{
    Task<GuildInvite> CreateInviteAsync(Guid guildId, Guid creatorId, int? maxUses = null, TimeSpan? expiresIn = null);
    Task<List<GuildInvite>> GetGuildInvitesAsync(Guid guildId);
    Task<GuildInvite?> GetByCodeAsync(string code);
    Task<Guild> JoinByCodeAsync(string code, Guid userId);
    Task RevokeInviteAsync(Guid inviteId, Guid userId);
}
