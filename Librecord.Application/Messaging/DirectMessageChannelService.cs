using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;

namespace Librecord.Application.Messaging;

public class DirectMessageChannelService : IDirectMessageChannelService
{
    private readonly IDirectMessageChannelRepository _dms;
    private readonly IFriendshipRepository _friendships;
    private readonly IBlockRepository _blocks;

    public DirectMessageChannelService(
        IDirectMessageChannelRepository dms,
        IFriendshipRepository friendships,
        IBlockRepository blocks)
    {
        _dms = dms;
        _friendships = friendships;
        _blocks = blocks;
    }

    // ---------------------------------------------------------
    // GETTERS
    // ---------------------------------------------------------
    public Task<DmChannel?> GetChannelAsync(Guid channelId)
    {
        return _dms.GetChannelAsync(channelId);
    }

    public Task<List<DmChannel>> GetUserChannelsAsync(Guid userId)
    {
        return _dms.GetUserDmChannelsAsync(userId);
    }
    
    public async Task<bool> IsMemberAsync(Guid channelId, Guid userId)
    {
        var channel = await _dms.GetChannelAsync(channelId);
        if (channel == null)
            return false;

        return channel.Members.Any(m => m.UserId == userId);
    }


    // ---------------------------------------------------------
    // START OR REUSE 1–1 DM
    // ---------------------------------------------------------
    public async Task<DmChannel> StartDmAsync(Guid requesterId, Guid targetUserId)
    {
        if (requesterId == targetUserId)
            throw new InvalidOperationException("Cannot DM yourself.");

        if (await _blocks.IsEitherBlockedAsync(requesterId, targetUserId))
            throw new InvalidOperationException("Cannot start a DM with this user.");

        var channels = await _dms.GetUserDmChannelsAsync(requesterId);

        var existing = channels.FirstOrDefault(c =>
            c.Members.Count == 2 &&
            c.Members.Any(m => m.UserId == targetUserId));

        if (existing != null)
            return existing;

        var channel = new DmChannel
        {
            Id = Guid.NewGuid()
        };

        channel.Members.Add(new DmChannelMember
        {
            ChannelId = channel.Id,
            UserId = requesterId,
            JoinedAt = DateTime.UtcNow
        });

        channel.Members.Add(new DmChannelMember
        {
            ChannelId = channel.Id,
            UserId = targetUserId,
            JoinedAt = DateTime.UtcNow
        });

        await _dms.AddChannelAsync(channel);
        await _dms.SaveChangesAsync();

        return channel;
    }

    // ---------------------------------------------------------
    // ADD PARTICIPANT (ANY MEMBER)
    // ---------------------------------------------------------
    public async Task AddParticipantAsync(
        Guid channelId,
        Guid requesterId,
        Guid newUserId)
    {
        var channel = await _dms.GetChannelAsync(channelId)
                      ?? throw new InvalidOperationException("DM not found.");

        if (channel.Members.All(m => m.UserId != requesterId))
            throw new UnauthorizedAccessException();

        if (channel.Members.Any(m => m.UserId == newUserId))
            return;

        if (await _blocks.IsEitherBlockedAsync(requesterId, newUserId))
            throw new InvalidOperationException("Cannot add this user.");

        if (!await _friendships.UsersAreConfirmedFriendsAsync(requesterId, newUserId))
            throw new UnauthorizedAccessException(
                "Users must be confirmed friends to perform this action.");

        channel.Members.Add(new DmChannelMember
        {
            ChannelId = channel.Id,
            UserId = newUserId,
            JoinedAt = DateTime.UtcNow
        });

        await _dms.SaveChangesAsync();
    }

    // ---------------------------------------------------------
    // LEAVE CHANNEL
    // ---------------------------------------------------------
    public async Task LeaveChannelAsync(Guid channelId, Guid userId)
    {
        var channel = await _dms.GetChannelAsync(channelId)
                      ?? throw new InvalidOperationException("DM not found.");

        var member = channel.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
            return;

        channel.Members.Remove(member);

        // Delete channel if empty
        if (channel.Members.Count == 0) await _dms.DeleteChannelAsync(channel);

        await _dms.SaveChangesAsync();
    }
}