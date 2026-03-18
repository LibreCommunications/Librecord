using Librecord.Domain.Identity;

namespace Librecord.Domain.Messaging.Common;

public class MessageThread
{
    public Guid Id { get; set; }

    /// <summary>
    /// The message that started this thread.
    /// </summary>
    public Guid ParentMessageId { get; set; }
    public Message ParentMessage { get; set; } = null!;

    /// <summary>
    /// Channel where the parent message lives.
    /// </summary>
    public Guid ChannelId { get; set; }

    public string Name { get; set; } = null!;

    public Guid CreatorId { get; set; }
    public User Creator { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int MessageCount { get; set; }
    public DateTime? LastMessageAt { get; set; }
}
