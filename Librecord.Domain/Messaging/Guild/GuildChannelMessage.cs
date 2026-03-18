using Librecord.Domain.Guilds;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Domain.Messaging.Guild;

public class GuildChannelMessage
{
    // FK → Message
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;

    // FK → Guild channel
    public Guid ChannelId { get; set; }
    public GuildChannel Channel { get; set; } = null!;

    // Encryption metadata (ALWAYS present)
    public required byte[] EncryptionSalt { get; set; }
    public required string EncryptionAlgorithm { get; set; } // e.g. "AES-GCM"
}