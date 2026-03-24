using Librecord.Domain.Guilds;
using Librecord.Domain.Storage;

namespace Librecord.Application.Guilds;

public class GuildSettingsService : IGuildSettingsService
{
    private readonly IGuildRepository _guilds;
    private readonly IAttachmentStorageService _storage;

    public GuildSettingsService(IGuildRepository guilds, IAttachmentStorageService storage)
    {
        _guilds = guilds;
        _storage = storage;
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

        await _guilds.RemoveGuildAsync(guild);
        await _guilds.SaveChangesAsync();

        return (true, channelIds);
    }
}
