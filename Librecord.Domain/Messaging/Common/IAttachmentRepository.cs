namespace Librecord.Domain.Messaging.Common;

public interface IAttachmentRepository
{
    Task AddAttachmentAsync(MessageAttachment attachment);
    Task<List<string>> GetUrlsByChannelAsync(Guid channelId);
    Task<List<string>> GetUrlsByGuildAsync(Guid guildId);
    Task SaveChangesAsync();
}
