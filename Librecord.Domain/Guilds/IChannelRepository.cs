namespace Librecord.Domain.Guilds;

public interface IChannelRepository
{
    Task<GuildChannel?> GetChannelAsync(Guid id);
    Task<List<GuildChannel>> GetGuildChannelsAsync(Guid guildId);

    void AddChannel(GuildChannel channel);
    void UpdateChannel(GuildChannel channel);
    void DeleteChannel(GuildChannel channel);

    Task SaveChangesAsync();
}