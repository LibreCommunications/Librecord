using Librecord.Domain.Identity;

namespace Librecord.Domain.Guilds;

public class GuildChannelMember
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid ChannelId { get; set; }
    public GuildChannel Channel { get; set; } = null!;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}