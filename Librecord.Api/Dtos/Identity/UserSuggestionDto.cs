namespace Librecord.Api.Dtos.User;

public sealed class UserSuggestionDto
{
    public Guid UserId { get; init; }
    public string Username { get; init; } = null!;
    public string DisplayName { get; init; } = null!;
    public string? AvatarUrl { get; init; }
}