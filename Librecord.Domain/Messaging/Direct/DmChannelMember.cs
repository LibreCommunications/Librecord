using Librecord.Domain.Identity;

namespace Librecord.Domain.Messaging.Direct;

public class DmChannelMember
{
    public Guid ChannelId { get; set; }
    public DmChannel Channel { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}