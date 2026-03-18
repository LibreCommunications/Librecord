namespace Librecord.Domain.Guilds;

public interface IGuildInviteRepository
{
    Task<GuildInvite?> GetByIdAsync(Guid id);
    Task<GuildInvite?> GetByCodeAsync(string code);
    Task<List<GuildInvite>> GetByGuildIdAsync(Guid guildId);
    Task AddAsync(GuildInvite invite);
    Task DeleteAsync(Guid id);
    Task SaveChangesAsync();
}
