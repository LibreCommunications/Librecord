using System.ComponentModel.DataAnnotations.Schema;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Messaging.Guild;

namespace Librecord.Domain.Messaging.Common;

public class Message
{
    public Guid Id { get; set; }

    // Message payload stored in the database.
    //
    // This value represents the raw message bytes as persisted.
    // Encryption (if any) is handled at the infrastructure layer
    // (e.g., encryption at rest, disk-level, or column-level).
    //
    // IMPORTANT:
    // - Message content is NOT end-to-end encrypted.
    // - Server operators and application services can access plaintext.
    // - This field should only be written/read inside the repository layer.
    public byte[] Content { get; set; } = [];
    

    // Plaintext representation of the message content.
    //
    // This property exists purely for convenience at the
    // application/domain layer to avoid leaking storage concerns
    // (byte encoding, encryption, compression, etc.).
    //
    // The repository is responsible for mapping:
    //   ContentText (string) <-> Content (byte[])
    //
    // This property is NOT persisted and must never be exposed
    // directly by the data access layer.
    [NotMapped]
    public string? ContentText { get; set; } = "";



    // Audit / ordering
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }

    // Author
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    // Shared features
    public List<MessageAttachment> Attachments { get; set; } = [];
    public List<MessageReaction> Reactions { get; set; } = [];
    public List<MessageEdit> Edits { get; set; } = [];

    // Context (exactly one of these is non-null)
    public DmChannelMessage? DmContext { get; set; }
    public GuildChannelMessage? GuildContext { get; set; }
}