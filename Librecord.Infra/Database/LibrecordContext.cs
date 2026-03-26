using Librecord.Domain.Auditing;
using Librecord.Domain.Guilds;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Messaging.Guild;
using Librecord.Domain.Permissions;
using Librecord.Domain.Social;
using Librecord.Domain.Voice;
using Librecord.Infra.Database.Seeders;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Database;

public class LibrecordContext
    : IdentityUserContext<User, Guid, UserClaim, UserLogin, UserToken>
{
    public LibrecordContext(DbContextOptions<LibrecordContext> options)
        : base(options)
    {
    }

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<Guild> Guilds => Set<Guild>();
    public DbSet<GuildMember> GuildMembers => Set<GuildMember>();
    public DbSet<GuildMemberRole> GuildMemberRoles => Set<GuildMemberRole>();
    public DbSet<GuildRole> GuildRoles => Set<GuildRole>();
    public DbSet<GuildBan> GuildBans => Set<GuildBan>();
    public DbSet<GuildInvite> GuildInvites => Set<GuildInvite>();

    public DbSet<GuildChannel> GuildChannels => Set<GuildChannel>();
    public DbSet<GuildChannelMember> GuildChannelMembers =>
        Set<GuildChannelMember>();
    public DbSet<GuildChannelPermissionOverride> GuildChannelPermissionOverrides =>
        Set<GuildChannelPermissionOverride>();

    public DbSet<DmChannel> DmChannels => Set<DmChannel>();
    public DbSet<DmChannelMember> DmChannelMembers =>
        Set<DmChannelMember>();
    public DbSet<DmChannelMessage> DmChannelMessages =>
        Set<DmChannelMessage>();

    public DbSet<GuildChannelMessage> GuildChannelMessages =>
        Set<GuildChannelMessage>();

    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageAttachment> MessageAttachments =>
        Set<MessageAttachment>();
    public DbSet<MessageReaction> MessageReactions =>
        Set<MessageReaction>();
    public DbSet<MessageEdit> MessageEdits =>
        Set<MessageEdit>();
    public DbSet<ChannelReadState> ChannelReadStates =>
        Set<ChannelReadState>();
    public DbSet<PinnedMessage> PinnedMessages =>
        Set<PinnedMessage>();
    public DbSet<MessageThread> MessageThreads =>
        Set<MessageThread>();
    public DbSet<ThreadMessage> ThreadMessages =>
        Set<ThreadMessage>();

    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions =>
        Set<RolePermission>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<UserPresence> UserPresences => Set<UserPresence>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<UserBlock> UserBlocks => Set<UserBlock>();

    public DbSet<VoiceState> VoiceStates => Set<VoiceState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(LibrecordContext).Assembly
        );

        PermissionSeeder.Seed(modelBuilder);
    }
}
