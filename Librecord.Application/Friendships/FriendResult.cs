using Librecord.Domain.Social;

namespace Librecord.Application.Models.Results;

public class FriendResult
{
    public bool Success { get; private set; }
    public string? Error { get; private set; }

    public Guid? FriendshipId { get; private set; }
    public Guid? RequesterId { get; private set; }
    public Guid? TargetId { get; private set; }
    public FriendshipStatus? Status { get; private set; }

    public static FriendResult Fail(string error)
    {
        return new FriendResult
        {
            Success = false,
            Error = error
        };
    }

    public static FriendResult FromFriendship(Friendship friendship)
    {
        return new FriendResult
        {
            Success = true,
            FriendshipId = friendship.Id,
            RequesterId = friendship.RequesterId,
            TargetId = friendship.TargetId,
            Status = friendship.Status
        };
    }

    public static FriendResult SuccessOnly()
    {
        return new FriendResult
        {
            Success = true
        };
    }
}