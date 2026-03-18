using Librecord.Domain.Identity;

namespace Librecord.Domain.Guilds;

public class GuildInvite
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public Guid CreatorId { get; set; }
    public User Creator { get; set; } = null!;

    public int? MaxUses { get; set; }
    public int UsesCount { get; set; }

    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
