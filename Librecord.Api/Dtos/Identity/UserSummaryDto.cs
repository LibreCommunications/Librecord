namespace Librecord.Api.Dtos.Identity;

using Librecord.Domain.Identity;

public sealed class UserSummaryDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = null!;
    public string DisplayName { get; init; } = null!;
    public string? AvatarUrl { get; init; }

    public static UserSummaryDto From(User user)
    {
        return new UserSummaryDto
        {
            Id = user.Id,
            Username = user.UserName!,
            DisplayName = user.DisplayName,
            AvatarUrl = user.AvatarUrl
        };
    }
}