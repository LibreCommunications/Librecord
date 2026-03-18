namespace Librecord.Application.Messaging;

public sealed class MessageEditSnapshot
{
    public Guid EditorId { get; init; }
    public string EditorUsername { get; init; } = null!;
    public string EditorDisplayName { get; init; } = null!;
    public string? EditorAvatarUrl { get; init; }

    public DateTime EditedAt { get; init; }
}