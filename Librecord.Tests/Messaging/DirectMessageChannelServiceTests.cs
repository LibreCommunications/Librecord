using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;
using Librecord.Domain.Storage;
using Microsoft.Extensions.Logging;
using Moq;

namespace Librecord.Tests.Messaging;

public class DirectMessageChannelServiceTests
{
    private readonly Mock<IDirectMessageChannelRepository> _dms = new();
    private readonly Mock<IFriendshipRepository> _friendships = new();
    private readonly Mock<IBlockRepository> _blocks = new();
    private readonly Mock<IAttachmentStorageService> _storage = new();
    private readonly Mock<IReadStateRepository> _readStates = new();

    private DirectMessageChannelService CreateService() =>
        new(_dms.Object, _friendships.Object, _blocks.Object, _storage.Object, _readStates.Object,
            Mock.Of<ILogger<DirectMessageChannelService>>());

    private static DmChannel MakeChannel(Guid channelId, params Guid[] memberIds)
    {
        var channel = new DmChannel { Id = channelId };
        foreach (var uid in memberIds)
            channel.Members.Add(new DmChannelMember { ChannelId = channelId, UserId = uid });
        return channel;
    }

    private static DmChannel MakeGroupChannel(Guid channelId, params Guid[] memberIds)
    {
        var channel = new DmChannel { Id = channelId, IsGroup = true };
        foreach (var uid in memberIds)
            channel.Members.Add(new DmChannelMember { ChannelId = channelId, UserId = uid });
        return channel;
    }

    // ---------------------------------------------------------
    // IS MEMBER
    // ---------------------------------------------------------

    [Fact]
    public async Task IsMember_UserInChannel_ReturnsTrue()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, userId, Guid.NewGuid());
        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        Assert.True(await svc.IsMemberAsync(channelId, userId));
    }

    [Fact]
    public async Task IsMember_UserNotInChannel_ReturnsFalse()
    {
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, Guid.NewGuid());
        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        Assert.False(await svc.IsMemberAsync(channelId, Guid.NewGuid()));
    }

    [Fact]
    public async Task IsMember_ChannelNotFound_ReturnsFalse()
    {
        _dms.Setup(d => d.GetChannelAsync(It.IsAny<Guid>())).ReturnsAsync((DmChannel?)null);

        var svc = CreateService();
        Assert.False(await svc.IsMemberAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    // ---------------------------------------------------------
    // START DM
    // ---------------------------------------------------------

    [Fact]
    public async Task StartDm_NewConversation_CreatesChannel()
    {
        var requesterId = Guid.NewGuid();
        var targetId = Guid.NewGuid();

        _dms.Setup(d => d.GetUserDmChannelsAsync(requesterId)).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.StartDmAsync(requesterId, targetId);

        Assert.NotNull(result);
        Assert.Equal(2, result.Members.Count);
        _dms.Verify(d => d.AddChannelAsync(It.IsAny<DmChannel>()), Times.Once);
        _dms.Verify(d => d.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task StartDm_ExistingConversation_ReusesChannel()
    {
        var requesterId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var existingChannel = MakeChannel(Guid.NewGuid(), requesterId, targetId);

        _dms.Setup(d => d.GetUserDmChannelsAsync(requesterId)).ReturnsAsync([existingChannel]);

        var svc = CreateService();
        var result = await svc.StartDmAsync(requesterId, targetId);

        Assert.Equal(existingChannel.Id, result.Id);
        _dms.Verify(d => d.AddChannelAsync(It.IsAny<DmChannel>()), Times.Never);
    }

    [Fact]
    public async Task StartDm_WithSelf_Throws()
    {
        var userId = Guid.NewGuid();

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.StartDmAsync(userId, userId));
    }

    [Fact]
    public async Task StartDm_Blocked_Throws()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();

        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.StartDmAsync(alice, bob));

        Assert.Contains("Cannot start", ex.Message);
        _dms.Verify(d => d.AddChannelAsync(It.IsAny<DmChannel>()), Times.Never);
    }

    // ---------------------------------------------------------
    // ADD PARTICIPANT
    // ---------------------------------------------------------

    [Fact]
    public async Task AddParticipant_ValidFriend_AddsToChannel()
    {
        var requesterId = Guid.NewGuid();
        var newUserId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, requesterId, Guid.NewGuid());

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _friendships.Setup(f => f.UsersAreConfirmedFriendsAsync(requesterId, newUserId))
            .ReturnsAsync(true);

        var svc = CreateService();
        await svc.AddParticipantAsync(channelId, requesterId, newUserId);

        Assert.Equal(3, channel.Members.Count);
        _dms.Verify(d => d.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task AddParticipant_NotFriends_Throws()
    {
        var requesterId = Guid.NewGuid();
        var newUserId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, requesterId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _friendships.Setup(f => f.UsersAreConfirmedFriendsAsync(requesterId, newUserId))
            .ReturnsAsync(false);

        var svc = CreateService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.AddParticipantAsync(channelId, requesterId, newUserId));
    }

    [Fact]
    public async Task AddParticipant_RequesterNotMember_Throws()
    {
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, Guid.NewGuid());
        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.AddParticipantAsync(channelId, Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task AddParticipant_Blocked_Throws()
    {
        var requesterId = Guid.NewGuid();
        var newUserId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, requesterId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _blocks.Setup(b => b.IsEitherBlockedAsync(requesterId, newUserId)).ReturnsAsync(true);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AddParticipantAsync(channelId, requesterId, newUserId));

        Assert.Contains("Cannot add", ex.Message);
    }

    [Fact]
    public async Task AddParticipant_AlreadyMember_NoOp()
    {
        var requesterId = Guid.NewGuid();
        var existingId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, requesterId, existingId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        await svc.AddParticipantAsync(channelId, requesterId, existingId);

        Assert.Equal(2, channel.Members.Count);
    }

    // ---------------------------------------------------------
    // LEAVE CHANNEL
    // ---------------------------------------------------------

    [Fact]
    public async Task LeaveChannel_MemberLeaves_RemovedFromMembers()
    {
        var userId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, userId, otherId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        await svc.LeaveChannelAsync(channelId, userId);

        Assert.Single(channel.Members);
        Assert.DoesNotContain(channel.Members, m => m.UserId == userId);
        _dms.Verify(d => d.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task LeaveChannel_LastMember_DeletesChannel()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, userId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        await svc.LeaveChannelAsync(channelId, userId);

        _dms.Verify(d => d.DeleteChannelAsync(channel), Times.Once);
    }

    [Fact]
    public async Task LeaveChannel_NotAMember_NoOp()
    {
        var channelId = Guid.NewGuid();
        var channel = MakeGroupChannel(channelId, Guid.NewGuid());

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        await svc.LeaveChannelAsync(channelId, Guid.NewGuid());

        Assert.Single(channel.Members);
    }
}
