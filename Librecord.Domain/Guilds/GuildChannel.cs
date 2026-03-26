using Librecord.Domain.Messaging;
using Librecord.Domain.Messaging.Guild;

namespace Librecord.Domain.Guilds;

public class GuildChannel
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public GuildChannelType Type { get; set; } = GuildChannelType.Text;

    public string? Topic { get; set; }

    public int Position { get; set; }

    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    public Guid? ParentId { get; set; }
    public GuildChannel? Parent { get; set; }
    public List<GuildChannel> Children { get; set; } = [];

    public List<GuildChannelPermissionOverride> PermissionOverrides { get; set; } = [];

    public List<GuildChannelMember> Members { get; set; } = [];

    public List<GuildChannelMessage> Messages { get; set; } = [];

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}