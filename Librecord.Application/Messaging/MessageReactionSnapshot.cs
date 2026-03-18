namespace Librecord.Application.Messaging;


public sealed class MessageReactionSnapshot
{
    public string Emoji { get; init; } = null!;
    public Guid UserId { get; init; }
}