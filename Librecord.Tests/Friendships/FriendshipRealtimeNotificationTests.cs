using Librecord.Application.Realtime.Social;
using Librecord.Application.Services;
using Librecord.Domain.Identity;
using Librecord.Domain.Social;
using Moq;

namespace Librecord.Tests.Friendships;

/// <summary>
/// Tests that verify real-time events are dispatched with correct payloads
/// for friendship mutations, and NOT dispatched on failures.
/// </summary>
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
    // SEND REQUEST — FriendRequestReceived
    // ---------------------------------------------------------

    [Fact]
    public async Task SendRequest_EmitsReceivedEvent_ToTargetUser()
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
            e.FromUsername == "alice" &&
            e.FromDisplayName == "alice" &&
            e.FromAvatarUrl == "/avatars/alice.png"
        )), Times.Once);
    }

    [Fact]
    public async Task SendRequest_NoEvent_WhenUserNotFound()
    {
        _users.Setup(u => u.GetByUsernameAsync("ghost")).ReturnsAsync((User?)null);

        var svc = CreateService();
        await svc.SendRequestAsync(Guid.NewGuid(), "ghost");

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    [Fact]
    public async Task SendRequest_NoEvent_WhenSendingToSelf()
    {
        var userId = Guid.NewGuid();
        var user = MakeUser(userId);
        _users.Setup(u => u.GetByUsernameAsync("alice")).ReturnsAsync(user);

        var svc = CreateService();
        await svc.SendRequestAsync(userId, "alice");

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    [Fact]
    public async Task SendRequest_NoEvent_WhenBlocked()
    {
        var requesterId = Guid.NewGuid();
        var target = MakeUser(name: "bob");

        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(target);
        _blocks.Setup(b => b.IsEitherBlockedAsync(requesterId, target.Id)).ReturnsAsync(true);

        var svc = CreateService();
        await svc.SendRequestAsync(requesterId, "bob");

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    [Fact]
    public async Task SendRequest_NoEvent_WhenAlreadyPending()
    {
        var requesterId = Guid.NewGuid();
        var target = MakeUser(name: "bob");
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
        await svc.SendRequestAsync(requesterId, "bob");

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    // ---------------------------------------------------------
    // ACCEPT — FriendRequestAccepted
    // ---------------------------------------------------------

    [Fact]
    public async Task Accept_EmitsAcceptedEvent_ToOriginalRequester()
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
            e.FriendUsername == "bob" &&
            e.FriendDisplayName == "bob" &&
            e.FriendAvatarUrl == "/avatars/bob.png"
        )), Times.Once);
    }

    [Fact]
    public async Task Accept_NoEvent_WhenNoPendingRequest()
    {
        _repo.Setup(r => r.GetFriendshipAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync((Friendship?)null);

        var svc = CreateService();
        await svc.AcceptRequestAsync(Guid.NewGuid(), Guid.NewGuid());

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    // ---------------------------------------------------------
    // DECLINE — FriendRequestDeclined
    // ---------------------------------------------------------

    [Fact]
    public async Task Decline_EmitsDeclinedEvent_ToOriginalRequester()
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

    [Fact]
    public async Task Decline_NoEvent_WhenRequestNotFound()
    {
        _repo.Setup(r => r.GetFriendshipAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync((Friendship?)null);

        var svc = CreateService();
        await svc.DeclineRequestAsync(Guid.NewGuid(), Guid.NewGuid());

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    [Fact]
    public async Task Decline_NoEvent_WhenAlreadyAccepted()
    {
        var fs = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = Guid.NewGuid(),
            TargetId = Guid.NewGuid(),
            Status = FriendshipStatus.Accepted
        };

        _repo.Setup(r => r.GetFriendshipAsync(fs.RequesterId, fs.TargetId)).ReturnsAsync(fs);

        var svc = CreateService();
        await svc.DeclineRequestAsync(fs.TargetId, fs.RequesterId);

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    // ---------------------------------------------------------
    // REMOVE — FriendRemoved
    // ---------------------------------------------------------

    [Fact]
    public async Task Remove_EmitsRemovedEvent_ToRemovedFriend()
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

    [Fact]
    public async Task Remove_NoEvent_WhenNotFriends()
    {
        _repo.Setup(r => r.GetFriendshipAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync((Friendship?)null);

        var svc = CreateService();
        await svc.RemoveFriendAsync(Guid.NewGuid(), Guid.NewGuid());

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }

    [Fact]
    public async Task Remove_NoEvent_WhenOnlyPending()
    {
        var userId = Guid.NewGuid();
        var friendId = Guid.NewGuid();
        var fs = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = userId,
            TargetId = friendId,
            Status = FriendshipStatus.Pending
        };

        _repo.Setup(r => r.GetFriendshipAsync(userId, friendId)).ReturnsAsync(fs);

        var svc = CreateService();
        await svc.RemoveFriendAsync(userId, friendId);

        _notifier.Verify(n => n.NotifyAsync(It.IsAny<FriendshipEvent>()), Times.Never);
    }
}
