using Librecord.Application.Messaging;
using Librecord.Domain.Guilds;

namespace Librecord.Application.Messaging;

public class ChannelService : IChannelService
{
    private readonly IChannelRepository _channels;

    public ChannelService(IChannelRepository channels)
    {
        _channels = channels;
    }

    // ---------------------------------------------------------
    // CHANNEL
    // ---------------------------------------------------------
    public Task<GuildChannel?> GetChannelAsync(Guid channelId)
    {
        return _channels.GetChannelAsync(channelId);
    }

    public Task<List<GuildChannel>> GetGuildChannelsAsync(Guid guildId)
    {
        return _channels.GetGuildChannelsAsync(guildId);
    }


    public async Task<GuildChannel> CreateChannelAsync(GuildChannel channel)
    {
        _channels.AddChannel(channel);
        await _channels.SaveChangesAsync();
        return channel;
    }

    public async Task<bool> UpdateChannelAsync(GuildChannel channel)
    {
        _channels.UpdateChannel(channel);
        await _channels.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteChannelAsync(Guid channelId)
    {
        var channel = await _channels.GetChannelAsync(channelId);
        if (channel == null)
            return false;

        _channels.DeleteChannel(channel);
        await _channels.SaveChangesAsync();
        return true;
    }
}