using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Api.Dtos.Messages;

public sealed class MessageReactionDto
{
    public string Emoji { get; init; } = null!;
    public Guid UserId { get; init; }

    public static MessageReactionDto From(MessageReaction reaction)
    {
        return new MessageReactionDto
        {
            Emoji = reaction.Emoji,
            UserId = reaction.UserId
        };
    }
    
    public static MessageReactionDto From(MessageReactionSnapshot reaction) =>
        new()
        {
            Emoji = reaction.Emoji,
            UserId = reaction.UserId
        };
}