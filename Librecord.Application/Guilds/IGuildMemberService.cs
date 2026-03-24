using Librecord.Domain.Guilds;

namespace Librecord.Application.Guilds;

public interface IGuildMemberService
{
    Task<bool> KickMemberAsync(Guid guildId, Guid userId);
    Task BanMemberAsync(Guid guildId, Guid userId, Guid moderatorId, string? reason);
    Task<bool> UnbanMemberAsync(Guid guildId, Guid userId);
    Task<IReadOnlyList<GuildBan>> GetBansAsync(Guid guildId);
}
