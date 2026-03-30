using Librecord.Domain.Guilds;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Storage;
using Microsoft.Extensions.Logging;

namespace Librecord.Application.Messaging;

public class ChannelService : IChannelService
{
    private readonly IChannelRepository _channels;
    private readonly IAttachmentRepository _attachments;
    private readonly IAttachmentStorageService _storage;
    private readonly ILogger<ChannelService> _logger;

    public ChannelService(
        IChannelRepository channels,
        IAttachmentRepository attachments,
        IAttachmentStorageService storage,
        ILogger<ChannelService> logger)
    {
        _channels = channels;
        _attachments = attachments;
        _storage = storage;
        _logger = logger;
    }

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

        // Collect attachment URLs before cascade delete removes them
        var attachmentUrls = await _attachments.GetUrlsByChannelAsync(channelId);

        _channels.DeleteChannel(channel);
        await _channels.SaveChangesAsync();

        // Best-effort storage cleanup after DB commit
        foreach (var url in attachmentUrls)
        {
            try { await _storage.DeleteAsync(url); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete attachment {Url} during channel cleanup", url);
            }
        }

        return true;
    }
}
