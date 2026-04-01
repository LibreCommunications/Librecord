using Librecord.Application.Realtime.Social;
using Librecord.Application.Services;
using Librecord.Domain.Identity;
using Librecord.Domain.Social;
using Moq;

namespace Librecord.Tests.Friendships;

public class FriendshipRealtimeNotificationTests
{
    private readonly Mock<IFriendshipRepository> _repo = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IBlockRepository> _blocks = new();
    private readonly Mock<IFriendshipRealtimeNotifier> _notifier = new();

    private FriendshipService CreateService() =>
        new(_repo.Object, _users.Object, _blocks.Object, _notifier.Object);

    private static User MakeUser(Guid? id = null, string name = "alice") => new()
    {
        Id = id ?? Guid.NewGuid(),
        UserName = name,
        DisplayName = name,
        AvatarUrl = $"/avatars/{name}.png"
    };

    // ---------------------------------------------------------
    // SEND REQUEST
    // ---------------------------------------------------------

    [Fact]
    public async Task When_FriendRequestSent_Should_NotifyTargetUser()
    {
        var requesterId = Guid.NewGuid();
        var requester = MakeUser(requesterId, "alice");
        var target = MakeUser(name: "bob");

        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(target);
        _users.Setup(u => u.GetByIdAsync(requesterId)).ReturnsAsync(requester);
        _repo.Setup(r => r.GetFriendshipAsync(requesterId, target.Id)).ReturnsAsync((Friendship?)null);

        var svc = CreateService();
        await svc.SendRequestAsync(requesterId, "bob");

        _notifier.Verify(n => n.NotifyAsync(It.Is<FriendRequestReceived>(e =>
            e.UserId == target.Id &&
            e.FromUserId == requesterId &&
            e.FromUsername == "alice"
        )), Times.Once);
    }

    // ---------------------------------------------------------
    // ACCEPT
    // ---------------------------------------------------------

    [Fact]
    public async Task When_RequestAccepted_Should_NotifyRequester()
    {
        var userId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var acceptor = MakeUser(userId, "bob");
        var fs = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            TargetId = userId,
            Status = FriendshipStatus.Pending
        };

        _repo.Setup(r => r.GetFriendshipAsync(requesterId, userId)).ReturnsAsync(fs);
        _users.Setup(u => u.GetByIdAsync(userId)).ReturnsAsync(acceptor);

        var svc = CreateService();
        await svc.AcceptRequestAsync(userId, requesterId);

        _notifier.Verify(n => n.NotifyAsync(It.Is<FriendRequestAccepted>(e =>
            e.UserId == requesterId &&
            e.FriendUserId == userId &&
            e.FriendUsername == "bob"
        )), Times.Once);
    }

    // ---------------------------------------------------------
    // DECLINE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_RequestDeclined_Should_NotifyRequester()
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
        await svc.DeclineRequestAsync(userId, requesterId);

        _notifier.Verify(n => n.NotifyAsync(It.Is<FriendRequestDeclined>(e =>
            e.UserId == requesterId &&
            e.DeclinedByUserId == userId
        )), Times.Once);
    }

    // ---------------------------------------------------------
    // REMOVE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_FriendRemoved_Should_NotifyOtherUser()
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
        await svc.RemoveFriendAsync(userId, friendId);

        _notifier.Verify(n => n.NotifyAsync(It.Is<FriendRemoved>(e =>
            e.UserId == friendId &&
            e.RemovedByUserId == userId
        )), Times.Once);
    }
}
