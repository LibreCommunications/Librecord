using Librecord.Domain.Identity;

namespace Librecord.Domain.Messaging.Common;

public class ChannelReadState
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>
    /// Either a DmChannel ID or a GuildChannel ID.
    /// </summary>
    public Guid ChannelId { get; set; }

    public Guid? LastReadMessageId { get; set; }
    public DateTime LastReadAt { get; set; } = DateTime.UtcNow;
}
