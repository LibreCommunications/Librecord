namespace Librecord.Application.Messaging;

public sealed class DmAuthorSnapshot
{
    public Guid Id { get; init; }
    public string Username { get; init; } = null!;
    public string DisplayName { get; init; } = null!;
    public string? AvatarUrl { get; init; }
}
