namespace Librecord.Application.Models.Results;

public sealed record UserSuggestionResult(
    Guid UserId,
    string Username,
    string DisplayName,
    string? AvatarUrl
);