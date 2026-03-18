namespace Librecord.Domain.Guilds;

public class GuildMemberRole
{
    public Guid UserId { get; set; }
    public Guid GuildId { get; set; }
    public GuildMember GuildMember { get; set; } = null!;

    public Guid RoleId { get; set; }
    public GuildRole Role { get; set; } = null!;
}