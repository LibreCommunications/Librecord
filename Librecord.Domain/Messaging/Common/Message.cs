using System.ComponentModel.DataAnnotations.Schema;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Messaging.Guild;

namespace Librecord.Domain.Messaging.Common;

public class Message
{
    public Guid Id { get; set; }

    // Message content is NOT end-to-end encrypted — server operators can access plaintext.
    // Encryption at rest is handled at the infrastructure layer.
    // This field should only be written/read inside the repository layer.
    public byte[] Content { get; set; } = [];

    // Not persisted. The repository maps ContentText <-> Content (handling
    // byte encoding, encryption, etc.) so domain/application code never
    // touches the raw Content bytes directly.
    [NotMapped]
    public string? ContentText { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid? ReplyToMessageId { get; set; }
    public Message? ReplyToMessage { get; set; }

    public List<MessageAttachment> Attachments { get; set; } = [];
    public List<MessageReaction> Reactions { get; set; } = [];
    public List<MessageEdit> Edits { get; set; } = [];

    public DmChannelMessage? DmContext { get; set; }
    public GuildChannelMessage? GuildContext { get; set; }
}
