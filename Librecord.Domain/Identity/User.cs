using Librecord.Domain.Guilds;
using Librecord.Domain.Messaging;
using Librecord.Domain.Social;
using Microsoft.AspNetCore.Identity;

namespace Librecord.Domain.Identity;

public class User : IdentityUser<Guid>
{
    // Profile
    public required string DisplayName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? AvatarUrl { get; set; }

    // Memberships
    public List<GuildMember> GuildMemberships { get; set; } = [];
    public List<GuildChannelMember> ChannelMemberships { get; set; } = [];

    // Presence
    public UserPresence? Presence { get; set; }
}
