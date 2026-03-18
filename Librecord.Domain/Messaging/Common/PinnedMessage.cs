using Librecord.Domain.Identity;

namespace Librecord.Domain.Messaging.Common;

public class PinnedMessage
{
    public Guid ChannelId { get; set; }
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;

    public Guid PinnedById { get; set; }
    public User PinnedBy { get; set; } = null!;

    public DateTime PinnedAt { get; set; } = DateTime.UtcNow;
}
