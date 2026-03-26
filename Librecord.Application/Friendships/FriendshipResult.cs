using Librecord.Domain.Identity;
using Librecord.Domain.Social;

namespace Librecord.Application.Models.Results;

public class FriendshipResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }

    public Guid? FriendshipId { get; set; }
    public FriendshipStatus? Status { get; set; }

    public Guid? OtherUserId { get; set; }
    public string? OtherUsername { get; set; }
    public string? OtherDisplayName { get; set; }
    public string? OtherAvatarUrl { get; set; }

    public static FriendshipResult Fail(string error)
    {
        return new FriendshipResult { Success = false, Error = error };
    }

    public static FriendshipResult SuccessOnly()
    {
        return new FriendshipResult { Success = true };
    }

    public static FriendshipResult FromFriendship(Friendship fs, User other)
    {
        return new FriendshipResult
        {
            Success = true,
            FriendshipId = fs.Id,
            Status = fs.Status,
            OtherUserId = other.Id,
            OtherUsername = other.UserName,
            OtherDisplayName = other.DisplayName,
            OtherAvatarUrl = other.AvatarUrl
        };
    }
}