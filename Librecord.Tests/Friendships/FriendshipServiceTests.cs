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

    private FriendshipService CreateService() => new(_repo.Object, _users.Object, _blocks.Object);

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
    public async Task SendRequest_Success_CreatesPendingFriendship()
    {
        var requesterId = Guid.NewGuid();
        var target = MakeUser();

        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(target);
        _repo.Setup(r => r.GetFriendshipAsync(requesterId, target.Id)).ReturnsAsync((Friendship?)null);

        var svc = CreateService();
        var result = await svc.SendRequestAsync(requesterId, "bob");

        Assert.True(result.Success);
        Assert.Equal(FriendshipStatus.Pending, result.Status);
        _repo.Verify(r => r.AddAsync(It.Is<Friendship>(f =>
            f.RequesterId == requesterId &&
            f.TargetId == target.Id &&
            f.Status == FriendshipStatus.Pending
        )), Times.Once);
        _repo.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task SendRequest_UserNotFound_Fails()
    {
        _users.Setup(u => u.GetByUsernameAsync("ghost")).ReturnsAsync((User?)null);

        var svc = CreateService();
        var result = await svc.SendRequestAsync(Guid.NewGuid(), "ghost");

        Assert.False(result.Success);
        Assert.Contains("does not exist", result.Error);
    }

    [Fact]
    public async Task SendRequest_ToSelf_Fails()
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
    public async Task SendRequest_Blocked_Fails()
    {
        var requesterId = Guid.NewGuid();
        var target = MakeUser();

        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(target);
        _blocks.Setup(b => b.IsEitherBlockedAsync(requesterId, target.Id)).ReturnsAsync(true);

        var svc = CreateService();
        var result = await svc.SendRequestAsync(requesterId, "bob");

        Assert.False(result.Success);
        Assert.Contains("Cannot friend", result.Error);
        _repo.Verify(r => r.AddAsync(It.IsAny<Friendship>()), Times.Never);
    }

    [Fact]
    public async Task SendRequest_AlreadyPending_Fails()
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

    [Fact]
    public async Task SendRequest_AlreadyFriends_Fails()
    {
        var requesterId = Guid.NewGuid();
        var target = MakeUser();
        var existing = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            TargetId = target.Id,
            Status = FriendshipStatus.Accepted
        };

        _users.Setup(u => u.GetByUsernameAsync("bob")).ReturnsAsync(target);
        _repo.Setup(r => r.GetFriendshipAsync(requesterId, target.Id)).ReturnsAsync(existing);

        var svc = CreateService();
        var result = await svc.SendRequestAsync(requesterId, "bob");

        Assert.False(result.Success);
        Assert.Contains("Already friends", result.Error);
    }

    // ---------------------------------------------------------
    // ACCEPT
    // ---------------------------------------------------------

    [Fact]
    public async Task Accept_PendingRequest_Succeeds()
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
        var result = await svc.AcceptRequestAsync(userId, requesterId);

        Assert.True(result.Success);
        Assert.Equal(FriendshipStatus.Accepted, fs.Status);
        _repo.Verify(r => r.UpdateAsync(fs), Times.Once);
    }

    [Fact]
    public async Task Accept_NoPendingRequest_Fails()
    {
        _repo.Setup(r => r.GetFriendshipAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync((Friendship?)null);

        var svc = CreateService();
        var result = await svc.AcceptRequestAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.False(result.Success);
        Assert.Contains("No pending", result.Error);
    }

    // ---------------------------------------------------------
    // DECLINE
    // ---------------------------------------------------------

    [Fact]
    public async Task Decline_PendingRequest_DeletesFriendship()
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

    [Fact]
    public async Task Decline_AcceptedFriendship_Fails()
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
        var result = await svc.DeclineRequestAsync(fs.TargetId, fs.RequesterId);

        Assert.False(result.Success);
        Assert.Contains("Cannot decline", result.Error);
    }

    // ---------------------------------------------------------
    // REMOVE
    // ---------------------------------------------------------

    [Fact]
    public async Task Remove_AcceptedFriend_Succeeds()
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

    [Fact]
    public async Task Remove_NotFriends_Fails()
    {
        _repo.Setup(r => r.GetFriendshipAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync((Friendship?)null);

        var svc = CreateService();
        var result = await svc.RemoveFriendAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.False(result.Success);
        Assert.Contains("not friends", result.Error);
    }
}
