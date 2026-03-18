using Librecord.Domain.Guilds;

namespace Librecord.Application.Messaging;

public interface IChannelService
{
    // ---------------------------------------------------------
    // CHANNEL
    // ---------------------------------------------------------
    Task<GuildChannel?> GetChannelAsync(Guid channelId);

    Task<List<GuildChannel>> GetGuildChannelsAsync(Guid guildId);

    // ---------------------------------------------------------
    // MUTATIONS
    // ---------------------------------------------------------
    Task<GuildChannel> CreateChannelAsync(GuildChannel channel);

    Task<bool> UpdateChannelAsync(GuildChannel channel);

    Task<bool> DeleteChannelAsync(Guid channelId);
}