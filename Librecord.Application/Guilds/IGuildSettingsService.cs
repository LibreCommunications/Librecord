using Librecord.Domain.Guilds;

namespace Librecord.Application.Guilds;

public interface IGuildSettingsService
{
    Task<Guild?> UpdateGuildAsync(Guid guildId, string? name);
    Task<string?> UploadGuildIconAsync(Guid guildId, Stream stream, string fileName, string contentType);
    Task<(bool Success, List<Guid> ChannelIds)> DeleteGuildAsync(Guid guildId);
}
