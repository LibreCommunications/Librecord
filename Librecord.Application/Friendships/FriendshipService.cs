using Librecord.Application.Friendships;
using Librecord.Application.Interfaces;
using Librecord.Application.Models;
using Librecord.Application.Models.Results;
using Librecord.Application.Realtime.Social;
using Librecord.Domain.Identity;
using Librecord.Domain.Social;

namespace Librecord.Application.Services;

public class FriendshipService : IFriendshipService
{
    private readonly IFriendshipRepository _repo;
    private readonly IUserRepository _users;
    private readonly IBlockRepository _blocks;
    private readonly IFriendshipRealtimeNotifier _notifier;

    public FriendshipService(
        IFriendshipRepository repo,
        IUserRepository users,
        IBlockRepository blocks,
        IFriendshipRealtimeNotifier notifier)
    {
        _repo = repo;
        _users = users;
        _blocks = blocks;
        _notifier = notifier;
    }

    // ---------------------------------------------------------
    // SEND REQUEST
    // ---------------------------------------------------------
    public async Task<FriendResult> SendRequestAsync(Guid requesterId, string username)
    {
        var targetUser = await _users.GetByUsernameAsync(username);

        if (targetUser == null)
            return FriendResult.Fail("User does not exist.");

        if (targetUser.Id == requesterId)
            return FriendResult.Fail("You cannot add yourself.");

        if (await _blocks.IsEitherBlockedAsync(requesterId, targetUser.Id))
            return FriendResult.Fail("Cannot friend this user.");

        var existing = await _repo.GetFriendshipAsync(requesterId, targetUser.Id);
        if (existing != null)
            return existing.Status switch
            {
                FriendshipStatus.Pending => FriendResult.Fail("Request already sent."),
                FriendshipStatus.Accepted => FriendResult.Fail("Already friends."),
                FriendshipStatus.Blocked => FriendResult.Fail("Cannot friend this user."),
                _ => FriendResult.Fail("Invalid state.")
            };

        var fs = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            TargetId = targetUser.Id,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        await _repo.AddAsync(fs);
        await _repo.SaveChangesAsync();

        var requester = await _users.GetByIdAsync(requesterId);
        if (requester != null)
        {
            await _notifier.NotifyAsync(new FriendRequestReceived
            {
                UserId = targetUser.Id,
                FromUserId = requesterId,
                FromUsername = requester.UserName ?? "",
                FromDisplayName = requester.DisplayName,
                FromAvatarUrl = requester.AvatarUrl
            });
        }

        return FriendResult.FromFriendship(fs);
    }

    // ---------------------------------------------------------
    // ACCEPT
    // ---------------------------------------------------------
    public async Task<FriendResult> AcceptRequestAsync(Guid userId, Guid requesterId)
    {
        var fs = await _repo.GetFriendshipAsync(requesterId, userId);

        if (fs == null || fs.Status != FriendshipStatus.Pending)
            return FriendResult.Fail("No pending request.");

        fs.Status = FriendshipStatus.Accepted;

        await _repo.UpdateAsync(fs);
        await _repo.SaveChangesAsync();

        var acceptor = await _users.GetByIdAsync(userId);
        if (acceptor != null)
        {
            await _notifier.NotifyAsync(new FriendRequestAccepted
            {
                UserId = requesterId,
                FriendUserId = userId,
                FriendUsername = acceptor.UserName ?? "",
                FriendDisplayName = acceptor.DisplayName,
                FriendAvatarUrl = acceptor.AvatarUrl
            });
        }

        return FriendResult.FromFriendship(fs);
    }

    // ---------------------------------------------------------
    // DECLINE
    // ---------------------------------------------------------
    public async Task<FriendResult> DeclineRequestAsync(Guid userId, Guid requesterId)
    {
        var fs = await _repo.GetFriendshipAsync(requesterId, userId);

        if (fs == null)
            return FriendResult.Fail("Request not found.");

        if (fs.Status != FriendshipStatus.Pending)
            return FriendResult.Fail("Cannot decline this request.");

        await _repo.DeleteAsync(fs);
        await _repo.SaveChangesAsync();

        // Notify the original requester that their request was declined/cancelled
        await _notifier.NotifyAsync(new FriendRequestDeclined
        {
            UserId = fs.RequesterId,
            DeclinedByUserId = userId
        });

        // Also notify the target so their incoming requests list updates
        await _notifier.NotifyAsync(new FriendRequestDeclined
        {
            UserId = fs.TargetId,
            DeclinedByUserId = userId
        });

        return FriendResult.SuccessOnly();
    }

    // ---------------------------------------------------------
    // REMOVE
    // ---------------------------------------------------------
    public async Task<FriendResult> RemoveFriendAsync(Guid userId, Guid friendId)
    {
        var fs = await _repo.GetFriendshipAsync(userId, friendId);

        if (fs == null || fs.Status != FriendshipStatus.Accepted)
            return FriendResult.Fail("You are not friends.");

        await _repo.DeleteAsync(fs);
        await _repo.SaveChangesAsync();

        await _notifier.NotifyAsync(new FriendRemoved
        {
            UserId = friendId,
            RemovedByUserId = userId
        });

        return FriendResult.SuccessOnly();
    }

    // ---------------------------------------------------------
    // FRIEND LIST (APPLICATION MODEL)
    // ---------------------------------------------------------
    public async Task<IReadOnlyList<FriendshipSummaryResult>> GetFriendsAsync(Guid userId)
    {
        var entries = await _repo.GetFriendshipsForUserAsync(userId);
        var results = new List<FriendshipSummaryResult>();

        foreach (var fs in entries)
        {
            var otherId = fs.RequesterId == userId
                ? fs.TargetId
                : fs.RequesterId;

            var other = await _users.GetByIdAsync(otherId);
            if (other == null)
                continue;

            results.Add(new FriendshipSummaryResult(
                other.Id,
                other.UserName ?? "",
                other.DisplayName,
                other.AvatarUrl
            ));
        }

        return results;
    }

    // ---------------------------------------------------------
    // REQUESTS (APPLICATION MODEL)
    // ---------------------------------------------------------
    public async Task<(IReadOnlyList<FriendRequestSummaryResult> Incoming,
            IReadOnlyList<FriendRequestSummaryResult> Outgoing)>
        GetRequestsAsync(Guid userId)
    {
        var incomingRaw = await _repo.GetIncomingRequestsAsync(userId);
        var outgoingRaw = await _repo.GetOutgoingRequestsAsync(userId);
        var blockedIds = await _blocks.GetAllBlockedUserIdsAsync(userId);

        var incoming = new List<FriendRequestSummaryResult>();
        var outgoing = new List<FriendRequestSummaryResult>();

        foreach (var fs in incomingRaw.Where(f => !blockedIds.Contains(f.RequesterId)))
        {
            var other = await _users.GetByIdAsync(fs.RequesterId);
            if (other == null) continue;

            incoming.Add(new FriendRequestSummaryResult(
                other.Id,
                other.UserName ?? "",
                other.DisplayName,
                other.AvatarUrl,
                fs.CreatedAt
            ));
        }

        foreach (var fs in outgoingRaw.Where(f => !blockedIds.Contains(f.TargetId)))
        {
            var other = await _users.GetByIdAsync(fs.TargetId);
            if (other == null) continue;

            outgoing.Add(new FriendRequestSummaryResult(
                other.Id,
                other.UserName ?? "",
                other.DisplayName,
                other.AvatarUrl,
                fs.CreatedAt
            ));
        }

        return (incoming, outgoing);
    }

    // ---------------------------------------------------------
    // USER SUGGESTIONS (APPLICATION MODEL)
    // ---------------------------------------------------------
    public async Task<IReadOnlyList<UserSuggestionResult>> SuggestUsernamesAsync(
        string input,
        Guid userId)
    {
        if (string.IsNullOrWhiteSpace(input))
            return Array.Empty<UserSuggestionResult>();

        var users = await _users.GetSimilarUsernamesAsync(input);
        var relatedUserIds = await _repo.GetRelatedUserIdsAsync(userId);
        var blockedIds = await _blocks.GetAllBlockedUserIdsAsync(userId);

        return users
            .Where(u =>
                u.Id != userId &&
                !relatedUserIds.Contains(u.Id) &&
                !blockedIds.Contains(u.Id))
            .Select(u => new UserSuggestionResult(
                u.Id,
                u.UserName ?? "",
                u.DisplayName,
                u.AvatarUrl
            ))
            .ToList();
    }
}