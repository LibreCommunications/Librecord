using Librecord.Domain.Guilds;

namespace Librecord.Domain.Permissions;

public class RolePermission
{
    public Guid RoleId { get; set; }
    public GuildRole Role { get; set; } = null!;

    public Guid PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;

    public bool Allow { get; set; }
}