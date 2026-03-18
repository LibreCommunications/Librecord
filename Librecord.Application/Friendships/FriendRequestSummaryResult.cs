namespace Librecord.Application.Models.Results;

public sealed record FriendRequestSummaryResult(
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarUrl,
    DateTime RequestedAt
);