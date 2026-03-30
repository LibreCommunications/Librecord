namespace Librecord.Application.Messaging;

public sealed class ReplySnapshot
{
    public Guid MessageId { get; init; }
    public string Content { get; init; } = "";
    public ReplyAuthorSnapshot? Author { get; init; }
}

public sealed class ReplyAuthorSnapshot
{
    public Guid Id { get; init; }
    public string Username { get; init; } = "";
    public string DisplayName { get; init; } = "";
    public string? AvatarUrl { get; init; }
}
