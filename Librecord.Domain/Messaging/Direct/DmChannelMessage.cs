using Librecord.Domain.Messaging.Common;

namespace Librecord.Domain.Messaging.Direct;

public class DmChannelMessage
{
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;

    public Guid ChannelId { get; set; }
    public DmChannel Channel { get; set; } = null!;

    // Encryption metadata (server-side, always present)
    public required byte[] EncryptionSalt { get; set; }

    // Identifies how Content was encrypted at rest (e.g. "AES-GCM")
    public required string EncryptionAlgorithm { get; set; }
}
