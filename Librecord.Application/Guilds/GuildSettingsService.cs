using Librecord.Domain.Guilds;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Storage;
using Microsoft.Extensions.Logging;

namespace Librecord.Application.Guilds;

public class GuildSettingsService : IGuildSettingsService
{
    private readonly IGuildRepository _guilds;
    private readonly IAttachmentStorageService _storage;
    private readonly IAttachmentRepository _attachments;
    private readonly ILogger<GuildSettingsService> _logger;

    public GuildSettingsService(
        IGuildRepository guilds,
        IAttachmentStorageService storage,
        IAttachmentRepository attachments,
        ILogger<GuildSettingsService> logger)
    {
        _guilds = guilds;
        _storage = storage;
        _attachments = attachments;
        _logger = logger;
    }

    public async Task<Guild?> UpdateGuildAsync(Guid guildId, string? name)
    {
        var guild = await _guilds.GetGuildAsync(guildId);
        if (guild == null) return null;

        if (!string.IsNullOrWhiteSpace(name))
            guild.Name = name.Trim();

        await _guilds.SaveChangesAsync();
        return guild;
    }

    public async Task<string?> UploadGuildIconAsync(Guid guildId, Stream stream, string fileName, string contentType)
    {
        var guild = await _guilds.GetGuildAsync(guildId);
        if (guild == null) return null;

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var objectName = $"guild-icons/{guildId}{ext}";

        await _storage.UploadAsync(objectName, stream, contentType);

        guild.IconUrl = $"/cdn/public/{objectName}";
        await _guilds.SaveChangesAsync();

        return guild.IconUrl;
    }

    public async Task<(bool Success, List<Guid> ChannelIds)> DeleteGuildAsync(Guid guildId)
    {
        var guild = await _guilds.GetGuildAsync(guildId);
        if (guild == null) return (false, []);

        var channelIds = await _guilds.GetChannelIdsAsync(guildId);

        // Collect attachment URLs before cascade delete
        var attachmentUrls = await _attachments.GetUrlsByGuildAsync(guildId);

        // Also collect guild icon URL
        var iconUrl = guild.IconUrl;

        await _guilds.RemoveGuildAsync(guild);
        await _guilds.SaveChangesAsync();

        // Best-effort storage cleanup
        foreach (var url in attachmentUrls)
        {
            try { await _storage.DeleteAsync(url); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete attachment {Url} during guild cleanup", url);
            }
        }
        if (iconUrl != null)
        {
            try { await _storage.DeleteAsync(iconUrl); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete guild icon {Url} during guild cleanup", iconUrl);
            }
        }

        return (true, channelIds);
    }
}
