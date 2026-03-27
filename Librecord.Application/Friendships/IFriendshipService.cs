using Librecord.Application.Friendships;
using Librecord.Application.Models;
using Librecord.Application.Models.Results;

namespace Librecord.Application.Interfaces;

public interface IFriendshipService
{
    Task<FriendResult> SendRequestAsync(Guid requesterId, string username);
    Task<FriendResult> AcceptRequestAsync(Guid userId, Guid requesterId);
    Task<FriendResult> DeclineRequestAsync(Guid userId, Guid requesterId);
    Task<FriendResult> RemoveFriendAsync(Guid userId, Guid friendId);


    Task<IReadOnlyList<FriendshipSummaryResult>>
        GetFriendsAsync(Guid userId);

    Task<(IReadOnlyList<FriendRequestSummaryResult> Incoming,
            IReadOnlyList<FriendRequestSummaryResult> Outgoing)>
        GetRequestsAsync(Guid userId);

    Task<IReadOnlyList<UserSuggestionResult>>
        SuggestUsernamesAsync(string input, Guid userId);
}