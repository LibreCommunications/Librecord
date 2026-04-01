using Librecord.Application.Realtime.Social;
using Librecord.Application.Services;
using Librecord.Domain.Identity;
using Librecord.Domain.Social;
using Moq;

namespace Librecord.Tests.Friendships;

public class FriendshipServiceTests
{
    private readonly Mock<IFriendshipRepository> _repo = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IBlockRepository> _blocks = new();
    private readonly Mock<IFriendshipRealtimeNotifier> _notifier = new();

    private FriendshipService CreateService() =>
        new(_repo.Object, _users.Object, _blocks.Object, _notifier.Object);

    private static User MakeUser(Guid? id = null, string name = "bob") => new()
    {
        Id = id ?? Guid.NewGuid(),
        UserName = name,
        DisplayName = name
    };

    // ---------------------------------------------------------
    // SEND REQUEST
    // ---------------------------------------------------------

    [Fact]
    public async Task When_SendingFriendRequest_Should_CreatePendingRequest()
    {
        var requesterId = Guid.NewGuid();
        var target = MakeUser();

        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(target);
        _repo.Setup(r => r.GetFriendshipAsync(requesterId, target.Id)).ReturnsAsync((Friendship?)null);
        _users.Setup(u => u.GetByIdAsync(requesterId)).ReturnsAsync(MakeUser(requesterId, "alice"));

        var svc = CreateService();
        var result = await svc.SendRequestAsync(requesterId, "bob");

        Assert.True(result.Success);
        Assert.Equal(FriendshipStatus.Pending, result.Status);
        _repo.Verify(r => r.AddAsync(It.Is<Friendship>(f =>
            f.RequesterId == requesterId &&
            f.TargetId == target.Id &&
            f.Status == FriendshipStatus.Pending
        )), Times.Once);
    }

    [Fact]
    public async Task When_SendingRequestToSelf_Should_Fail()
    {
        var userId = Guid.NewGuid();
        var user = MakeUser(userId);
        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(user);

        var svc = CreateService();
        var result = await svc.SendRequestAsync(userId, "bob");

        Assert.False(result.Success);
        Assert.Contains("yourself", result.Error);
    }

    [Fact]
    public async Task When_SendingDuplicateRequest_Should_Fail()
    {
        var requesterId = Guid.NewGuid();
        var target = MakeUser();
        var existing = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            TargetId = target.Id,
            Status = FriendshipStatus.Pending
        };

        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(target);
        _repo.Setup(r => r.GetFriendshipAsync(requesterId, target.Id)).ReturnsAsync(existing);

        var svc = CreateService();
        var result = await svc.SendRequestAsync(requesterId, "bob");

        Assert.False(result.Success);
        Assert.Contains("already sent", result.Error);
    }

    // ---------------------------------------------------------
    // ACCEPT
    // ---------------------------------------------------------

    [Fact]
    public async Task When_AcceptingRequest_Should_CreateConfirmedFriendship()
    {
        var userId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var fs = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            TargetId = userId,
            Status = FriendshipStatus.Pending
        };

        _repo.Setup(r => r.GetFriendshipAsync(requesterId, userId)).ReturnsAsync(fs);
        _users.Setup(u => u.GetByIdAsync(userId)).ReturnsAsync(MakeUser(userId));

        var svc = CreateService();
        var result = await svc.AcceptRequestAsync(userId, requesterId);

        Assert.True(result.Success);
        Assert.Equal(FriendshipStatus.Accepted, fs.Status);
    }

    // ---------------------------------------------------------
    // DECLINE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_DecliningRequest_Should_RemoveIt()
    {
        var userId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var fs = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            TargetId = userId,
            Status = FriendshipStatus.Pending
        };

        _repo.Setup(r => r.GetFriendshipAsync(requesterId, userId)).ReturnsAsync(fs);

        var svc = CreateService();
        var result = await svc.DeclineRequestAsync(userId, requesterId);

        Assert.True(result.Success);
        _repo.Verify(r => r.DeleteAsync(fs), Times.Once);
    }

    // ---------------------------------------------------------
    // REMOVE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_RemovingFriend_Should_RemoveBidirectionalFriendship()
    {
        var userId = Guid.NewGuid();
        var friendId = Guid.NewGuid();
        var fs = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = userId,
            TargetId = friendId,
            Status = FriendshipStatus.Accepted
        };

        _repo.Setup(r => r.GetFriendshipAsync(userId, friendId)).ReturnsAsync(fs);

        var svc = CreateService();
        var result = await svc.RemoveFriendAsync(userId, friendId);

        Assert.True(result.Success);
        _repo.Verify(r => r.DeleteAsync(fs), Times.Once);
    }
}
