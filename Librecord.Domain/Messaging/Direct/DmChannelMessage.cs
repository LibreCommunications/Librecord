using Librecord.Domain.Messaging.Common;

namespace Librecord.Domain.Messaging.Direct;

public class DmChannelMessage
{
    // FK → Message
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;

    // FK → DM channel
    public Guid ChannelId { get; set; }
    public DmChannel Channel { get; set; } = null!;

    // Encryption metadata (server-side, always present)
    public required byte[] EncryptionSalt { get; set; }

    // Identifies how Content was encrypted at rest
    // e.g. "AES-GCM", "ChaCha20-Poly1305"
    public required string EncryptionAlgorithm { get; set; }
}