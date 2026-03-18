using Librecord.Domain.Permissions;

namespace Librecord.Domain.Guilds;

public class GuildRole
{
    public Guid Id { get; set; }

    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public required string Name { get; set; }

    // Higher number = higher role
    public int Position { get; set; }

    // Permissions assigned to this role
    public List<RolePermission> Permissions { get; set; } = [];

    // Users that have this role
    public List<GuildMemberRole> Members { get; set; } = [];
}