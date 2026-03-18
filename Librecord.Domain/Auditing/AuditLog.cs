using Librecord.Domain.Guilds;
using Librecord.Domain.Identity;

namespace Librecord.Domain.Auditing;

public class AuditLog
{
    public Guid Id { get; set; }

    // Scope: Which guild does this audit event belong to?
    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    // Optional: Which user caused the action?
    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }

    // Optional: Which user was targeted by the action?
    public Guid? TargetUserId { get; set; }
    public User? TargetUser { get; set; }

    // Event type — stored as string for maximum flexibility
    // Examples: "BanUser", "DeleteMessage", "UpdateChannel", "RoleAssigned"
    public required string Action { get; set; }

    // JSON payload of before/after changes or details
    public string DetailsJson { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}