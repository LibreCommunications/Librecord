namespace Librecord.Domain.Messaging.Direct;

public interface IDirectMessageChannelRepository
{
    Task<DmChannel?> GetChannelAsync(Guid id);
    Task<List<DmChannel>> GetUserDmChannelsAsync(Guid userId);

    Task AddChannelAsync(DmChannel channel);
    Task UpdateChannelAsync(DmChannel channel);
    Task DeleteChannelAsync(DmChannel channel);

    Task SaveChangesAsync();
}