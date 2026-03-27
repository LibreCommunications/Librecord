using Librecord.Domain.Identity;

namespace Librecord.Domain.Guilds;

public class GuildBan
{
    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid ModeratorId { get; set; }
    public User Moderator { get; set; } = null!;

    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}