using Librecord.Domain.Messaging;
using Librecord.Domain.Messaging.Guild;

namespace Librecord.Domain.Guilds;

public class GuildChannel
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    // Text, Voice, Category, Forum, etc.
    public GuildChannelType Type { get; set; } = GuildChannelType.Text;

    public string? Topic { get; set; }

    // Sidebar ordering
    public int Position { get; set; }

    public Guid GuildId { get; set; }
    public Guild Guild { get; set; } = null!;

    // Category / Thread structure
    public Guid? ParentId { get; set; }
    public GuildChannel? Parent { get; set; }
    public List<GuildChannel> Children { get; set; } = [];

    // Per-channel permission overrides
    public List<GuildChannelPermissionOverride> PermissionOverrides { get; set; } = [];

    // Members who can access this channel
    public List<GuildChannelMember> Members { get; set; } = [];

    // Messages in this channel
    public List<GuildChannelMessage> Messages { get; set; } = [];

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}