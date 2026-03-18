using Librecord.Domain.Identity;

namespace Librecord.Domain.Messaging.Common;

public class MessageEdit
{
    public Guid Id { get; set; }

    public Guid EditorUserId { get; set; }
    public User Editor { get; set; } = null!;

    public string? OldContent { get; set; } = "";
    public DateTime EditedAt { get; set; } = DateTime.UtcNow;
    
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;
}
