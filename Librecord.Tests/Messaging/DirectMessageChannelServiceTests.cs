using Librecord.Application.Messaging;
using Librecord.Domain;
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

    private static Mock<IUnitOfWork> MockUow()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.ExecuteInTransactionAsync(It.IsAny<Func<Task>>()))
            .Returns((Func<Task> action) => action());
        uow.Setup(u => u.SaveChangesAsync()).Returns(Task.CompletedTask);
        return uow;
    }

    private DirectMessageChannelService CreateService() =>
        new(_dms.Object, _friendships.Object, _blocks.Object, _storage.Object, _readStates.Object,
            MockUow().Object, Mock.Of<ILogger<DirectMessageChannelService>>());

    private static DmChannel MakeChannel(Guid channelId, bool isGroup = false, params Guid[] memberIds)
    {
        var channel = new DmChannel { Id = channelId, IsGroup = isGroup };
        foreach (var uid in memberIds)
            channel.Members.Add(new DmChannelMember { ChannelId = channelId, UserId = uid });
        return channel;
    }

    // ---------------------------------------------------------
    // CREATING 1-ON-1 DM
    // ---------------------------------------------------------

    [Fact]
    public async Task When_StartingNewDm_Should_CreateChannelWithBothMembers()
    {
        var requesterId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        _dms.Setup(d => d.GetUserDmChannelsAsync(requesterId)).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.StartDmAsync(requesterId, targetId);

        Assert.NotNull(result);
        Assert.Equal(2, result.Members.Count);
        Assert.Contains(result.Members, m => m.UserId == requesterId);
        Assert.Contains(result.Members, m => m.UserId == targetId);
        Assert.False(result.IsGroup);
    }

    [Fact]
    public async Task When_StartingDmThatAlreadyExists_Should_ReturnExistingChannel()
    {
        var requesterId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var existingChannel = MakeChannel(Guid.NewGuid(), false, requesterId, targetId);
        _dms.Setup(d => d.GetUserDmChannelsAsync(requesterId)).ReturnsAsync([existingChannel]);

        var svc = CreateService();
        var result = await svc.StartDmAsync(requesterId, targetId);

        Assert.Equal(existingChannel.Id, result.Id);
    }

    [Fact]
    public async Task When_StartingDmWithSelf_Should_Throw()
    {
        var userId = Guid.NewGuid();
        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.StartDmAsync(userId, userId));
    }

    [Fact]
    public async Task When_StartingDmWithBlockedUser_Should_Reject()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.StartDmAsync(alice, bob));
        Assert.Contains("Cannot start", ex.Message);
    }

    // ---------------------------------------------------------
    // CREATING GROUP DM
    // ---------------------------------------------------------

    [Fact]
    public async Task When_CreatingGroupDm_Should_IncludeAllMembers()
    {
        var creator = Guid.NewGuid();
        var member1 = Guid.NewGuid();
        var member2 = Guid.NewGuid();
        var memberIds = new List<Guid> { member1, member2 };

        _friendships.Setup(f => f.UsersAreConfirmedFriendsAsync(creator, It.IsAny<Guid>()))
            .ReturnsAsync(true);

        var svc = CreateService();
        var result = await svc.CreateGroupAsync(creator, memberIds, "Test Group");

        Assert.True(result.IsGroup);
        Assert.Equal(3, result.Members.Count);
        Assert.Contains(result.Members, m => m.UserId == creator);
        Assert.Contains(result.Members, m => m.UserId == member1);
        Assert.Contains(result.Members, m => m.UserId == member2);
        Assert.Equal("Test Group", result.Name);
    }

    [Fact]
    public async Task When_CreatingGroupDmWithBlockedUser_Should_Reject()
    {
        var creator = Guid.NewGuid();
        var blocked = Guid.NewGuid();
        _blocks.Setup(b => b.IsEitherBlockedAsync(creator, blocked)).ReturnsAsync(true);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateGroupAsync(creator, [blocked], "Group"));
    }

    [Fact]
    public async Task When_CreatingGroupDmWithNonFriend_Should_Reject()
    {
        var creator = Guid.NewGuid();
        var stranger = Guid.NewGuid();
        _friendships.Setup(f => f.UsersAreConfirmedFriendsAsync(creator, stranger))
            .ReturnsAsync(false);

        var svc = CreateService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.CreateGroupAsync(creator, [stranger], "Group"));
    }

    // ---------------------------------------------------------
    // ADDING PARTICIPANT
    // ---------------------------------------------------------

    [Fact]
    public async Task When_AddingFriendToGroupDm_Should_AddMember()
    {
        var requesterId = Guid.NewGuid();
        var newUserId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, true, requesterId, Guid.NewGuid());

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _friendships.Setup(f => f.UsersAreConfirmedFriendsAsync(requesterId, newUserId))
            .ReturnsAsync(true);

        var svc = CreateService();
        await svc.AddParticipantAsync(channelId, requesterId, newUserId);

        Assert.Equal(3, channel.Members.Count);
        Assert.Contains(channel.Members, m => m.UserId == newUserId);
    }

    [Fact]
    public async Task When_AddingAlreadyPresentMember_Should_NoOp()
    {
        var requesterId = Guid.NewGuid();
        var existingId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, true, requesterId, existingId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        await svc.AddParticipantAsync(channelId, requesterId, existingId);

        Assert.Equal(2, channel.Members.Count);
    }

    [Fact]
    public async Task When_AddingParticipantTo1on1Dm_Should_Reject()
    {
        var requesterId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, false, requesterId, Guid.NewGuid());

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AddParticipantAsync(channelId, requesterId, Guid.NewGuid()));
    }

    // ---------------------------------------------------------
    // LEAVING CHANNEL
    // ---------------------------------------------------------

    [Fact]
    public async Task When_LeavingGroupDm_Should_RemoveMember()
    {
        var userId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, true, userId, otherId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        await svc.LeaveChannelAsync(channelId, userId);

        Assert.Single(channel.Members);
        Assert.DoesNotContain(channel.Members, m => m.UserId == userId);
    }

    [Fact]
    public async Task When_LastMemberLeavesGroupDm_Should_DeleteChannel()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, true, userId);

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        await svc.LeaveChannelAsync(channelId, userId);

        _dms.Verify(d => d.DeleteChannelAsync(channel), Times.Once);
    }

    [Fact]
    public async Task When_Leaving1on1Dm_Should_Reject()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, false, userId, Guid.NewGuid());

        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.LeaveChannelAsync(channelId, userId));
    }

    // ---------------------------------------------------------
    // MEMBERSHIP CHECKS
    // ---------------------------------------------------------

    [Fact]
    public async Task When_CheckingMembership_Should_ReturnTrueForMember()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, false, userId, Guid.NewGuid());
        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        Assert.True(await svc.IsMemberAsync(channelId, userId));
    }

    [Fact]
    public async Task When_CheckingMembership_Should_ReturnFalseForNonMember()
    {
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, false, Guid.NewGuid());
        _dms.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        Assert.False(await svc.IsMemberAsync(channelId, Guid.NewGuid()));
    }

    [Fact]
    public async Task When_CheckingMembershipOfMissingChannel_Should_ReturnFalse()
    {
        _dms.Setup(d => d.GetChannelAsync(It.IsAny<Guid>())).ReturnsAsync((DmChannel?)null);

        var svc = CreateService();
        Assert.False(await svc.IsMemberAsync(Guid.NewGuid(), Guid.NewGuid()));
    }
}
