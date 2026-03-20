using Librecord.Domain.Messaging.Direct;

namespace Librecord.Application.Messaging;

public interface IDirectMessageChannelService
{
    Task<DmChannel?> GetChannelAsync(Guid channelId);
    Task<List<DmChannel>> GetUserChannelsAsync(Guid userId);

    Task<DmChannel> StartDmAsync(Guid requesterId, Guid targetUserId);
    Task<DmChannel> CreateGroupAsync(Guid creatorId, List<Guid> memberIds);

    Task AddParticipantAsync(
        Guid channelId,
        Guid requesterId,
        Guid newUserId);

    Task LeaveChannelAsync(Guid channelId, Guid userId);

    Task<bool> IsMemberAsync(Guid channelId, Guid userId);
    Task<int> GetMemberCountAsync(Guid channelId);
}
