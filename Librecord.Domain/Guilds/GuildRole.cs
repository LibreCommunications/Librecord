using Librecord.Domain.Permissions;

namespace Librecord.Domain.Guilds;

public class GuildRole
{
    public Guid Id { get; set; }

    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public required string Name { get; set; }

    public int Position { get; set; }

    public List<RolePermission> Permissions { get; set; } = [];

    public List<GuildMemberRole> Members { get; set; } = [];
}