using Librecord.Domain.Identity;

namespace Librecord.Domain.Guilds;

public class GuildMember
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public List<GuildMemberRole> Roles { get; set; } = [];
}