namespace Librecord.Domain.Permissions;

public static class PermissionIds
{
    public static readonly Guid GuildViewGuild =
        Guid.Parse("11111111-1111-1111-1111-111111111101");

    public static readonly Guid GuildReadMessages =
        Guid.Parse("11111111-1111-1111-1111-111111111102");

    public static readonly Guid GuildManageGuild =
        Guid.Parse("11111111-1111-1111-1111-111111111103");

    public static readonly Guid GuildManageChannels =
        Guid.Parse("11111111-1111-1111-1111-111111111104");

    public static readonly Guid GuildManageRoles =
        Guid.Parse("11111111-1111-1111-1111-111111111105");

    public static readonly Guid GuildInviteMembers =
        Guid.Parse("11111111-1111-1111-1111-111111111106");

    public static readonly Guid GuildKickMembers =
        Guid.Parse("11111111-1111-1111-1111-111111111107");

    public static readonly Guid GuildBanMembers =
        Guid.Parse("11111111-1111-1111-1111-111111111108");

    public static readonly Guid ChannelViewChannel =
        Guid.Parse("22222222-2222-2222-2222-222222222201");

    public static readonly Guid ChannelReadMessages =
        Guid.Parse("22222222-2222-2222-2222-222222222202");

    public static readonly Guid ChannelSendMessages =
        Guid.Parse("22222222-2222-2222-2222-222222222203");

    public static readonly Guid ChannelSendAttachments =
        Guid.Parse("22222222-2222-2222-2222-222222222204");

    public static readonly Guid ChannelAddReactions =
        Guid.Parse("22222222-2222-2222-2222-222222222205");

    public static readonly Guid ChannelManageMessages =
        Guid.Parse("22222222-2222-2222-2222-222222222206");

    public static readonly Guid ChannelManageChannels =
        Guid.Parse("22222222-2222-2222-2222-222222222207");
}
