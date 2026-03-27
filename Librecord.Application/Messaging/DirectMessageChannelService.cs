using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;
using Librecord.Domain.Storage;
using Microsoft.Extensions.Logging;

namespace Librecord.Application.Messaging;

public class DirectMessageChannelService : IDirectMessageChannelService
{
    private readonly IDirectMessageChannelRepository _dms;
    private readonly IFriendshipRepository _friendships;
    private readonly IBlockRepository _blocks;
    private readonly IAttachmentStorageService _storage;
    private readonly IReadStateRepository _readStates;
    private readonly ILogger<DirectMessageChannelService> _logger;

    public DirectMessageChannelService(
        IDirectMessageChannelRepository dms,
        IFriendshipRepository friendships,
        IBlockRepository blocks,
        IAttachmentStorageService storage,
        IReadStateRepository readStates,
        ILogger<DirectMessageChannelService> logger)
    {
        _dms = dms;
        _friendships = friendships;
        _blocks = blocks;
        _storage = storage;
        _readStates = readStates;
        _logger = logger;
    }

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

    public async Task<DmChannel> StartDmAsync(Guid requesterId, Guid targetUserId)
    {
        if (requesterId == targetUserId)
            throw new InvalidOperationException("Cannot DM yourself.");

        if (await _blocks.IsEitherBlockedAsync(requesterId, targetUserId))
            throw new InvalidOperationException("Cannot start a DM with this user.");

        var channels = await _dms.GetUserDmChannelsAsync(requesterId);

        var existing = channels.FirstOrDefault(c =>
            !c.IsGroup &&
            c.Members.Any(m => m.UserId == targetUserId));

        if (existing != null)
            return existing;

        var channel = new DmChannel
        {
            Id = Guid.NewGuid(),
            IsGroup = false
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

        try
        {
            await _dms.SaveChangesAsync();
        }
        catch (Exception)
        {
            // Possible race condition — another request created the same DM concurrently.
            // Re-fetch and return the existing channel if it now exists.
            var retryChannels = await _dms.GetUserDmChannelsAsync(requesterId);
            var retry = retryChannels.FirstOrDefault(c =>
                !c.IsGroup && c.Members.Any(m => m.UserId == targetUserId));

            if (retry != null) return retry;
            throw;
        }

        return channel;
    }

    public async Task<DmChannel> CreateGroupAsync(Guid creatorId, List<Guid> memberIds, string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Group name is required.");

        if (memberIds.Count < 1)
            throw new ArgumentException("Group DM requires at least one other member.");

        var allUserIds = new HashSet<Guid>(memberIds) { creatorId };
        if (allUserIds.Count < 2)
            throw new ArgumentException("Group DM requires at least two members.");

        foreach (var userId in memberIds)
        {
            if (await _blocks.IsEitherBlockedAsync(creatorId, userId))
                throw new InvalidOperationException("Cannot add a blocked user to a group.");

            if (!await _friendships.UsersAreConfirmedFriendsAsync(creatorId, userId))
                throw new UnauthorizedAccessException("All members must be friends with the creator.");
        }

        var channel = new DmChannel
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            IsGroup = true
        };

        foreach (var userId in allUserIds)
        {
            channel.Members.Add(new DmChannelMember
            {
                ChannelId = channel.Id,
                UserId = userId,
                JoinedAt = DateTime.UtcNow
            });
        }

        await _dms.AddChannelAsync(channel);
        await _dms.SaveChangesAsync();

        return channel;
    }

    public async Task AddParticipantAsync(
        Guid channelId,
        Guid requesterId,
        Guid newUserId)
    {
        var channel = await _dms.GetChannelAsync(channelId)
                      ?? throw new InvalidOperationException("DM not found.");

        if (!channel.IsGroup)
            throw new InvalidOperationException("Cannot add participants to a 1-on-1 DM.");

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

    public async Task LeaveChannelAsync(Guid channelId, Guid userId)
    {
        var channel = await _dms.GetChannelAsync(channelId)
                      ?? throw new InvalidOperationException("DM not found.");

        if (!channel.IsGroup)
            throw new InvalidOperationException("Cannot leave a 1-on-1 DM.");

        var member = channel.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
            return;

        channel.Members.Remove(member);

        if (channel.Members.Count == 0)
        {
            var fullChannel = await _dms.GetChannelWithMessagesAsync(channelId);
            if (fullChannel != null)
            {
                foreach (var dm in fullChannel.Messages)
                {
                    foreach (var att in dm.Message.Attachments)
                    {
                        try { await _storage.DeleteAsync(att.Url); }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to delete attachment {Url} during channel cleanup", att.Url);
                        }
                    }
                }
            }

            // Clean up read state records (no FK cascade for generic ChannelId)
            await _readStates.DeleteByChannelIdAsync(channelId);

            await _dms.DeleteChannelAsync(channel);
        }

        await _dms.SaveChangesAsync();
    }

    public async Task DeleteDmAsync(Guid channelId, Guid userId)
    {
        var channel = await _dms.GetChannelAsync(channelId)
                      ?? throw new InvalidOperationException("DM not found.");

        if (channel.IsGroup)
            throw new InvalidOperationException("Cannot delete a group DM. Use leave instead.");

        if (channel.Members.All(m => m.UserId != userId))
            throw new UnauthorizedAccessException("You are not a member of this DM.");

        var otherUser = channel.Members.FirstOrDefault(m => m.UserId != userId);
        if (otherUser != null && await _friendships.UsersAreConfirmedFriendsAsync(userId, otherUser.UserId))
            throw new InvalidOperationException("Cannot delete a DM with a current friend. Remove them as a friend first.");

        var fullChannel = await _dms.GetChannelWithMessagesAsync(channelId);
        if (fullChannel != null)
        {
            foreach (var dm in fullChannel.Messages)
            {
                foreach (var att in dm.Message.Attachments)
                {
                    try { await _storage.DeleteAsync(att.Url); }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to delete attachment {Url} during DM cleanup", att.Url);
                    }
                }
            }
        }

        // Clean up read state records (no FK cascade for generic ChannelId)
        await _readStates.DeleteByChannelIdAsync(channelId);

        await _dms.DeleteChannelAsync(channel);
        await _dms.SaveChangesAsync();
    }

    public async Task<bool> AreMembersFriendsAsync(Guid channelId, Guid userId)
    {
        var channel = await _dms.GetChannelAsync(channelId);
        if (channel == null || channel.IsGroup) return false;

        var otherUser = channel.Members.FirstOrDefault(m => m.UserId != userId);
        if (otherUser == null) return false;

        return await _friendships.UsersAreConfirmedFriendsAsync(userId, otherUser.UserId);
    }

    public async Task<int> GetMemberCountAsync(Guid channelId)
    {
        var channel = await _dms.GetChannelAsync(channelId);
        return channel?.Members.Count ?? 0;
    }
}
