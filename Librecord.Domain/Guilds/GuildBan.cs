using Librecord.Domain.Identity;

namespace Librecord.Domain.Guilds;

public class GuildBan
{
    // Composite key (GuildId + UserId) will be added in EF configuration
    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    // Moderator who issued the ban (cannot be null)
    public Guid ModeratorId { get; set; }
    public User Moderator { get; set; } = null!;

    // Optional reason
    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}