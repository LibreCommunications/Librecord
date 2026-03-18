using Librecord.Application.Friendships;
using Librecord.Application.Models.Results;

namespace Librecord.Api.Dtos.Friendships;

public class FriendshipListDto
{
    public Guid OtherUserId { get; set; }
    public string OtherUsername { get; set; } = null!;
    public string OtherDisplayName { get; set; } = null!;
    public string? OtherAvatarUrl { get; set; }

    public static FriendshipListDto From(FriendRequestSummaryResult user)
    {
        return new FriendshipListDto
        {
            OtherUserId = user.UserId,
            OtherUsername = user.Username,
            OtherDisplayName = user.DisplayName,
            OtherAvatarUrl = user.AvatarUrl
        };
    }

    public static FriendshipListDto From(FriendshipSummaryResult user)
    {
        return new FriendshipListDto
        {
            OtherUserId = user.UserId,
            OtherUsername = user.Username,
            OtherDisplayName = user.DisplayName,
            OtherAvatarUrl = user.AvatarUrl
        };
    }
}