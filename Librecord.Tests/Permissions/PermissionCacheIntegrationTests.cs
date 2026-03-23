using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Identity;
using Librecord.Domain.Permissions;
using Librecord.Infra.Database;
using Librecord.Infra.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Librecord.Tests.Permissions;

/// <summary>
/// Integration tests that verify the full grant → check → revoke → re-check
/// lifecycle for every permission, exercising the real repository cache layer.
/// Uses SQLite in-memory + real IMemoryCache + real PermissionService.
/// </summary>
public class PermissionCacheIntegrationTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly LibrecordContext _db;
    private readonly IMemoryCache _cache;
    private readonly GuildRepository _guildRepo;
    private readonly RoleRepository _roleRepo;
    private readonly PermissionRegistry _registry;
    private readonly PermissionService _permService;

    private readonly Guid _guildId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _channelId = Guid.NewGuid();
    private readonly Guid _roleId = Guid.NewGuid();

    public PermissionCacheIntegrationTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();

        var opts = new DbContextOptionsBuilder<LibrecordContext>()
            .UseSqlite(_conn)
            .Options;

        _db = new LibrecordContext(opts);
        _db.Database.EnsureCreated();

        _cache = new MemoryCache(new MemoryCacheOptions());
        _guildRepo = new GuildRepository(_db, _cache);
        _roleRepo = new RoleRepository(_db, _cache);
        _registry = new PermissionRegistry();
        _permService = new PermissionService(_guildRepo, _registry);

        SeedBaseData();
    }

    public void Dispose()
    {
        _db.Dispose();
        _conn.Dispose();
        _cache.Dispose();
    }

    private void SeedBaseData()
    {
        var user = new User
        {
            Id = _userId,
            UserName = "testuser",
            DisplayName = "Test User",
            NormalizedUserName = "TESTUSER",
            Email = "test@test.local",
            NormalizedEmail = "TEST@TEST.LOCAL",
        };
        _db.Users.Add(user);

        var guild = new Guild { Id = _guildId, Name = "Test Guild" };
        _db.Guilds.Add(guild);

        var role = new GuildRole { Id = _roleId, GuildId = _guildId, Name = "TestRole", Position = 1 };
        _db.GuildRoles.Add(role);

        var member = new GuildMember { UserId = _userId, GuildId = _guildId };
        member.Roles.Add(new GuildMemberRole { UserId = _userId, GuildId = _guildId, RoleId = _roleId });
        _db.GuildMembers.Add(member);

        var channel = new GuildChannel { Id = _channelId, GuildId = _guildId, Name = "test-channel" };
        _db.GuildChannels.Add(channel);

        // Permissions are already seeded by EnsureCreated via PermissionSeeder.HasData
        _db.SaveChanges();
    }

    // ────────────────────────────────────────────────────
    // GUILD: GRANT → CHECK → REVOKE → RE-CHECK
    // ────────────────────────────────────────────────────

    [Theory]
    [MemberData(nameof(AllGuildPermissions))]
    public async Task GuildPermission_GrantCheckRevokeCheck(PermissionCapability perm, string permKey, Guid permId)
    {
        // 1. Without permission — should be denied
        var denied = await _permService.HasGuildPermissionAsync(_userId, _guildId, perm);
        Assert.False(denied.Allowed, $"{permKey} should be denied before grant");

        // 2. Grant the permission to the role
        await _roleRepo.AddPermissionToRoleAsync(_roleId, permId, true);
        await _roleRepo.SaveChangesAsync();

        // Clear member cache so it re-fetches (role perms changed)
        // The generation counter bump in RoleRepository handles batch cache
        _cache.Remove($"repo:member:{_guildId}:{_userId}");

        var granted = await _permService.HasGuildPermissionAsync(_userId, _guildId, perm);
        Assert.True(granted.Allowed, $"{permKey} should be allowed after grant");

        // 3. Revoke the permission
        await _roleRepo.RemovePermissionFromRoleAsync(_roleId, permId);
        await _roleRepo.SaveChangesAsync();

        _cache.Remove($"repo:member:{_guildId}:{_userId}");

        var revoked = await _permService.HasGuildPermissionAsync(_userId, _guildId, perm);
        Assert.False(revoked.Allowed, $"{permKey} should be denied after revoke");
    }

    // ────────────────────────────────────────────────────
    // CHANNEL: GRANT VIA OVERRIDE → CHECK → REVOKE → RE-CHECK
    // ────────────────────────────────────────────────────

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task ChannelPermission_OverrideGrantCheckRevokeCheck(PermissionCapability perm, string permKey, Guid permId)
    {
        // 1. Without permission — should be denied (no role perms, no overrides)
        var denied = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.False(denied.Allowed, $"{permKey} should be denied before override");

        // 2. Add a user override that allows
        var overrideEntity = new GuildChannelPermissionOverride
        {
            Id = Guid.NewGuid(),
            ChannelId = _channelId,
            UserId = _userId,
            PermissionId = permId,
            Allow = true,
        };
        await _guildRepo.AddChannelOverrideAsync(overrideEntity);
        await _guildRepo.SaveChangesAsync();

        // Cache for channel overrides should have been invalidated
        var granted = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.True(granted.Allowed, $"{permKey} should be allowed after user override");

        // 3. Remove the override
        await _guildRepo.RemoveChannelOverrideAsync(overrideEntity);
        await _guildRepo.SaveChangesAsync();

        var revoked = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.False(revoked.Allowed, $"{permKey} should be denied after override removed");
    }

    // ────────────────────────────────────────────────────
    // CHANNEL: ROLE OVERRIDE LIFECYCLE
    // ────────────────────────────────────────────────────

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task ChannelPermission_RoleOverrideGrantCheckRevokeCheck(PermissionCapability perm, string permKey, Guid permId)
    {
        // 1. Without — denied
        var denied = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.False(denied.Allowed, $"{permKey} should be denied before role override");

        // 2. Add a role override that allows
        var overrideEntity = new GuildChannelPermissionOverride
        {
            Id = Guid.NewGuid(),
            ChannelId = _channelId,
            RoleId = _roleId,
            PermissionId = permId,
            Allow = true,
        };
        await _guildRepo.AddChannelOverrideAsync(overrideEntity);
        await _guildRepo.SaveChangesAsync();

        var granted = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.True(granted.Allowed, $"{permKey} should be allowed after role override");

        // 3. Remove the override
        await _guildRepo.RemoveChannelOverrideAsync(overrideEntity);
        await _guildRepo.SaveChangesAsync();

        var revoked = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.False(revoked.Allowed, $"{permKey} should be denied after role override removed");
    }

    // ────────────────────────────────────────────────────
    // TEST DATA
    // ────────────────────────────────────────────────────

    public static TheoryData<PermissionCapability, string, Guid> AllGuildPermissions => new()
    {
        { GuildPermission.ViewGuild, "ViewGuild", PermissionIds.GuildViewGuild },
        { GuildPermission.ReadMessages, "ReadMessages", PermissionIds.GuildReadMessages },
        { GuildPermission.ManageGuild, "ManageGuild", PermissionIds.GuildManageGuild },
        { GuildPermission.ManageChannels, "ManageChannels", PermissionIds.GuildManageChannels },
        { GuildPermission.ManageRoles, "ManageRoles", PermissionIds.GuildManageRoles },
        { GuildPermission.InviteMembers, "InviteMembers", PermissionIds.GuildInviteMembers },
        { GuildPermission.KickMembers, "KickMembers", PermissionIds.GuildKickMembers },
        { GuildPermission.BanMembers, "BanMembers", PermissionIds.GuildBanMembers },
    };

    public static TheoryData<PermissionCapability, string, Guid> AllChannelPermissions => new()
    {
        { ChannelPermission.ViewChannel, "ViewChannel", PermissionIds.ChannelViewChannel },
        { ChannelPermission.ReadMessages, "ReadMessages", PermissionIds.ChannelReadMessages },
        { ChannelPermission.SendMessages, "SendMessages", PermissionIds.ChannelSendMessages },
        { ChannelPermission.SendAttachments, "SendAttachments", PermissionIds.ChannelSendAttachments },
        { ChannelPermission.AddReactions, "AddReactions", PermissionIds.ChannelAddReactions },
        { ChannelPermission.ManageMessages, "ManageMessages", PermissionIds.ChannelManageMessages },
        { ChannelPermission.ManageChannels, "ManageChannels", PermissionIds.ChannelManageChannels },
    };
}
