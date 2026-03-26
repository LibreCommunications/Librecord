using Librecord.Domain.Guilds;

namespace Librecord.Application.Messaging;

public interface IChannelService
{
    Task<GuildChannel?> GetChannelAsync(Guid channelId);

    Task<List<GuildChannel>> GetGuildChannelsAsync(Guid guildId);

    Task<GuildChannel> CreateChannelAsync(GuildChannel channel);

    Task<bool> UpdateChannelAsync(GuildChannel channel);

    Task<bool> DeleteChannelAsync(Guid channelId);
}