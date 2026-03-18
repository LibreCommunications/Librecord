using Librecord.Domain.Identity;
using Librecord.Domain.Permissions;

namespace Librecord.Domain.Guilds;

public class GuildChannelPermissionOverride
{
    public Guid Id { get; set; }

    public Guid ChannelId { get; set; }
    public GuildChannel Channel { get; set; } = null!;

    public Guid? RoleId { get; set; }
    public GuildRole? Role { get; set; }

    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public Guid PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;

    public bool? Allow { get; set; }
    // true = allow
    // false = deny
    // null = inherit
}