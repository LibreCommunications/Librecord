using Librecord.Domain.Guilds;
using Librecord.Domain.Messaging;
using Librecord.Domain.Social;
using Microsoft.AspNetCore.Identity;

namespace Librecord.Domain.Identity;

public class User : IdentityUser<Guid>
{
    public required string DisplayName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public string? BannerUrl { get; set; }

    public List<GuildMember> GuildMemberships { get; set; } = [];
    public List<GuildChannelMember> ChannelMemberships { get; set; } = [];

    public UserPresence? Presence { get; set; }
}
