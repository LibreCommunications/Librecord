namespace Librecord.Domain.Permissions;

public static class KnownPermissions
{
    public static readonly IReadOnlyCollection<(PermissionCapability Perm, Guid Id, string Type)> All =
    [
        // -------------------------
        // GUILD
        // -------------------------
        (GuildPermission.ViewGuild, PermissionIds.GuildViewGuild, "Guild"),
        (GuildPermission.ReadMessages, PermissionIds.GuildReadMessages, "Guild"),
        (GuildPermission.ManageGuild, PermissionIds.GuildManageGuild, "Guild"),
        (GuildPermission.ManageChannels, PermissionIds.GuildManageChannels, "Guild"),
        (GuildPermission.ManageRoles, PermissionIds.GuildManageRoles, "Guild"),
        (GuildPermission.InviteMembers, PermissionIds.GuildInviteMembers, "Guild"),
        (GuildPermission.KickMembers, PermissionIds.GuildKickMembers, "Guild"),
        (GuildPermission.BanMembers, PermissionIds.GuildBanMembers, "Guild"),

        // -------------------------
        // CHANNEL
        // -------------------------
        (ChannelPermission.ViewChannel, PermissionIds.ChannelViewChannel, "Channel"),
        (ChannelPermission.ReadMessages, PermissionIds.ChannelReadMessages, "Channel"),
        (ChannelPermission.SendMessages, PermissionIds.ChannelSendMessages, "Channel"),
        (ChannelPermission.SendAttachments, PermissionIds.ChannelSendAttachments, "Channel"),
        (ChannelPermission.AddReactions, PermissionIds.ChannelAddReactions, "Channel"),
        (ChannelPermission.ManageMessages, PermissionIds.ChannelManageMessages, "Channel"),
        (ChannelPermission.ManageChannels, PermissionIds.ChannelManageChannels, "Channel"),
    ];
}