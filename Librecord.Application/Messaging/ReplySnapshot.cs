namespace Librecord.Application.Messaging;

public sealed class ReplySnapshot
{
    public Guid MessageId { get; init; }
    public string Content { get; init; } = "";
    public string? AuthorDisplayName { get; init; }
    public Guid? AuthorId { get; init; }
}
