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

        _db.SaveChanges();
    }

    private void ClearMemberCache()
    {
        _cache.Remove($"repo:member:{_guildId}:{_userId}");
    }

    [Fact]
    public async Task When_GrantingGuildPermission_Should_AllowSubsequentCheck()
    {
        var perm = GuildPermission.ViewGuild;
        var permId = PermissionIds.GuildViewGuild;

        var denied = await _permService.HasGuildPermissionAsync(_userId, _guildId, perm);
        Assert.False(denied.Allowed);

        await _roleRepo.AddPermissionToRoleAsync(_roleId, permId, true);
        await _roleRepo.SaveChangesAsync();
        ClearMemberCache();

        var granted = await _permService.HasGuildPermissionAsync(_userId, _guildId, perm);
        Assert.True(granted.Allowed);
    }

    [Fact]
    public async Task When_RevokingGuildPermission_Should_DenySubsequentCheck()
    {
        var perm = GuildPermission.ManageGuild;
        var permId = PermissionIds.GuildManageGuild;

        await _roleRepo.AddPermissionToRoleAsync(_roleId, permId, true);
        await _roleRepo.SaveChangesAsync();
        ClearMemberCache();

        var granted = await _permService.HasGuildPermissionAsync(_userId, _guildId, perm);
        Assert.True(granted.Allowed);

        await _roleRepo.RemovePermissionFromRoleAsync(_roleId, permId);
        await _roleRepo.SaveChangesAsync();
        ClearMemberCache();

        var revoked = await _permService.HasGuildPermissionAsync(_userId, _guildId, perm);
        Assert.False(revoked.Allowed);
    }

    [Fact]
    public async Task When_SettingChannelOverrideToAllow_Should_GrantPermission()
    {
        var perm = ChannelPermission.SendMessages;
        var permId = PermissionIds.ChannelSendMessages;

        var denied = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.False(denied.Allowed);

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

        var granted = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.True(granted.Allowed);
    }

    [Fact]
    public async Task When_SettingChannelOverrideToDeny_Should_DenyPermission()
    {
        var perm = ChannelPermission.SendMessages;
        var permId = PermissionIds.ChannelSendMessages;

        // First grant via role so we have something to deny
        await _roleRepo.AddPermissionToRoleAsync(_roleId, permId, true);
        await _roleRepo.SaveChangesAsync();
        ClearMemberCache();

        var grantedViaRole = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.True(grantedViaRole.Allowed);

        // Now add a user override that denies
        var overrideEntity = new GuildChannelPermissionOverride
        {
            Id = Guid.NewGuid(),
            ChannelId = _channelId,
            UserId = _userId,
            PermissionId = permId,
            Allow = false,
        };
        await _guildRepo.AddChannelOverrideAsync(overrideEntity);
        await _guildRepo.SaveChangesAsync();

        var denied = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.False(denied.Allowed);
    }

    [Fact]
    public async Task When_UserOverrideConflictsWithRoleOverride_Should_UserOverrideWin()
    {
        var perm = ChannelPermission.ViewChannel;
        var permId = PermissionIds.ChannelViewChannel;

        // Role override denies
        var roleOverride = new GuildChannelPermissionOverride
        {
            Id = Guid.NewGuid(),
            ChannelId = _channelId,
            RoleId = _roleId,
            PermissionId = permId,
            Allow = false,
        };
        await _guildRepo.AddChannelOverrideAsync(roleOverride);
        await _guildRepo.SaveChangesAsync();

        var deniedByRole = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.False(deniedByRole.Allowed);

        // User override allows -- should win over role deny
        var userOverride = new GuildChannelPermissionOverride
        {
            Id = Guid.NewGuid(),
            ChannelId = _channelId,
            UserId = _userId,
            PermissionId = permId,
            Allow = true,
        };
        await _guildRepo.AddChannelOverrideAsync(userOverride);
        await _guildRepo.SaveChangesAsync();

        var allowedByUser = await _permService.HasChannelPermissionAsync(_userId, _channelId, perm);
        Assert.True(allowedByUser.Allowed);
    }
}
