namespace Librecord.Domain.Messaging.Direct;

public interface IDirectMessageChannelRepository
{
    /// <summary>Lightweight: members + user info only. No messages.</summary>
    Task<DmChannel?> GetChannelAsync(Guid id);

    /// <summary>Heavy: includes all messages with attachments for deletion/cleanup.</summary>
    Task<DmChannel?> GetChannelWithMessagesAsync(Guid id);

    Task<List<DmChannel>> GetUserDmChannelsAsync(Guid userId);

    Task AddChannelAsync(DmChannel channel);
    Task UpdateChannelAsync(DmChannel channel);
    Task DeleteChannelAsync(DmChannel channel);

    Task SaveChangesAsync();
}