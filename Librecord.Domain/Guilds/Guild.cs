namespace Librecord.Domain.Guilds;

public class Guild
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? IconUrl { get; set; }

    public List<GuildChannel> Channels { get; set; } = [];
    public List<GuildMember> Members { get; set; } = [];

    public List<GuildRole> Roles { get; set; } = [];
}