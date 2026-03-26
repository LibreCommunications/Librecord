using Librecord.Domain.Guilds;
using Librecord.Domain.Identity;

namespace Librecord.Domain.Auditing;

public class AuditLog
{
    public Guid Id { get; set; }

    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }

    public Guid? TargetUserId { get; set; }
    public User? TargetUser { get; set; }

    public required string Action { get; set; }

    public string DetailsJson { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}