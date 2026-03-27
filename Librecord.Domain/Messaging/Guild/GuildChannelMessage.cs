using Librecord.Domain.Guilds;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Domain.Messaging.Guild;

public class GuildChannelMessage
{
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;

    public Guid ChannelId { get; set; }
    public GuildChannel Channel { get; set; } = null!;

    // Encryption metadata (always present)
    public required byte[] EncryptionSalt { get; set; }
    public required string EncryptionAlgorithm { get; set; }
}
