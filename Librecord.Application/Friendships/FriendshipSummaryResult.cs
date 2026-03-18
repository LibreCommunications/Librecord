namespace Librecord.Application.Friendships;

public sealed record FriendshipSummaryResult(
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarUrl
);