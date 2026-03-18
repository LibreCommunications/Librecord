using Librecord.Domain.Identity;

namespace Librecord.Domain.Messaging.Common;

public class MessageReaction
{
    // Composite key in EF: (MessageId, UserId, Emoji)

    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Emoji { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}