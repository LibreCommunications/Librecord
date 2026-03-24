namespace Librecord.Domain.Messaging.Common;

public interface IReadStateRepository
{
    Task<ChannelReadState?> GetAsync(Guid userId, Guid channelId);
    Task<List<ChannelReadState>> GetForUserAsync(Guid userId);
    Task UpsertAsync(Guid userId, Guid channelId, Guid messageId);
    Task<Dictionary<Guid, int>> GetUnreadCountsAsync(Guid userId, List<Guid> channelIds);
    Task DeleteByChannelIdAsync(Guid channelId);
    Task SaveChangesAsync();
}
