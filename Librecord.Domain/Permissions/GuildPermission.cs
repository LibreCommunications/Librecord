namespace Librecord.Domain.Permissions;

public abstract class GuildPermission : PermissionCapability
{
    public static readonly GuildPermission ViewGuild =
        new Impl("ViewGuild");

    public static readonly GuildPermission ReadMessages =
        new Impl("ReadMessages");

    public static readonly GuildPermission ManageGuild =
        new Impl("ManageGuild");

    public static readonly GuildPermission ManageChannels =
        new Impl("ManageChannels");

    public static readonly GuildPermission ManageRoles =
        new Impl("ManageRoles");

    public static readonly GuildPermission InviteMembers =
        new Impl("InviteMembers");

    public static readonly GuildPermission KickMembers =
        new Impl("KickMembers");

    public static readonly GuildPermission BanMembers =
        new Impl("BanMembers");

    protected GuildPermission(string key) : base(key)
    {
    }

    private sealed class Impl : GuildPermission
    {
        public Impl(string key) : base(key)
        {
        }
    }
}