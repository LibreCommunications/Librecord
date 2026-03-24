namespace Librecord.Domain.Messaging.Common;

public interface IPinRepository
{
    Task<PinnedMessage?> GetPinAsync(Guid channelId, Guid messageId);
    Task<List<PinnedMessage>> GetPinsForChannelAsync(Guid channelId);
    Task AddPinAsync(PinnedMessage pin);
    Task RemovePinAsync(PinnedMessage pin);
    Task<bool> IsMessageInChannelAsync(Guid channelId, Guid messageId);
    Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId);
    Task SaveChangesAsync();
}
