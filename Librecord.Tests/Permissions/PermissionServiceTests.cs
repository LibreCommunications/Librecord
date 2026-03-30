using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Moq;

namespace Librecord.Tests.Permissions;

public class PermissionServiceTests
{
    private readonly Mock<IGuildRepository> _guilds = new();
    private readonly PermissionRegistry _registry = new();

    private PermissionService CreateService() =>
        new(_guilds.Object, _registry);

    // ─── HELPERS ────────────────────────────────────────

    private static readonly Guid GuildId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid ChannelId = Guid.NewGuid();

    private GuildMember MakeMember(params (Guid roleId, List<Permission> perms)[] roles)
    {
        var member = new GuildMember
        {
            UserId = UserId,
            GuildId = GuildId,
            Roles = roles.Select(r => new GuildMemberRole
            {
                UserId = UserId,
                GuildId = GuildId,
                RoleId = r.roleId,
                Role = new GuildRole { Id = r.roleId, GuildId = GuildId, Name = "role" }
            }).ToList()
        };

        // Setup per-role queries (used by channel permission fallback)
        foreach (var (roleId, perms) in roles)
        {
            _guilds.Setup(g => g.GetRolePermissionsAsync(roleId))
                .ReturnsAsync(perms);
        }

        // Setup batch query (used by guild permission checks)
        var allPerms = roles.SelectMany(r => r.perms).Distinct().ToList();
        _guilds.Setup(g => g.GetRolesPermissionsBatchAsync(It.IsAny<IEnumerable<Guid>>()))
            .ReturnsAsync(allPerms);

        return member;
    }

    private static Permission MakePerm(string name, string type) =>
        new() { Id = Guid.NewGuid(), Name = name, Type = type };

    private static List<Permission> GuildPerms(params string[] names) =>
        names.Select(n => MakePerm(n, "Guild")).ToList();

    private static List<Permission> ChannelPerms(params string[] names) =>
        names.Select(n => MakePerm(n, "Channel")).ToList();

    private GuildChannel MakeChannel() =>
        new() { Id = ChannelId, GuildId = GuildId, Name = "test" };

    // ────────────────────────────────────────────────────
    // GUILD PERMISSION TESTS
    // ────────────────────────────────────────────────────

    [Fact]
    public async Task NonMember_DeniedAnyGuildPermission()
    {
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId))
            .ReturnsAsync((GuildMember?)null);

        var svc = CreateService();
        var result = await svc.HasGuildPermissionAsync(UserId, GuildId, GuildPermission.ViewGuild);

        Assert.False(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllGuildPermissions))]
    public async Task GuildPermission_Granted_WhenRoleHasIt(PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, GuildPerms(permKey)));
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);

        var svc = CreateService();
        var result = await svc.HasGuildPermissionAsync(UserId, GuildId, perm);

        Assert.True(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllGuildPermissions))]
    public async Task GuildPermission_Denied_WhenRoleLacksIt(PermissionCapability perm, string _)
    {
        var roleId = Guid.NewGuid();
        // Role has NO permissions
        var member = MakeMember((roleId, GuildPerms()));
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);

        var svc = CreateService();
        var result = await svc.HasGuildPermissionAsync(UserId, GuildId, perm);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task GuildPermission_MultipleRoles_GrantedFromSecondRole()
    {
        var role1 = Guid.NewGuid();
        var role2 = Guid.NewGuid();
        var member = MakeMember(
            (role1, GuildPerms("ViewGuild")),
            (role2, GuildPerms("ManageRoles"))
        );
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);

        var svc = CreateService();

        Assert.True((await svc.HasGuildPermissionAsync(UserId, GuildId, GuildPermission.ManageRoles)).Allowed);
        Assert.True((await svc.HasGuildPermissionAsync(UserId, GuildId, GuildPermission.ViewGuild)).Allowed);
        Assert.False((await svc.HasGuildPermissionAsync(UserId, GuildId, GuildPermission.BanMembers)).Allowed);
    }

    // ────────────────────────────────────────────────────
    // CHANNEL PERMISSION TESTS
    // ────────────────────────────────────────────────────

    [Fact]
    public async Task ChannelPermission_Denied_ChannelNotFound()
    {
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync((GuildChannel?)null);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task ChannelPermission_Denied_NonMember()
    {
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync((GuildMember?)null);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.False(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task ChannelPermission_FallsBackToGuildRole(PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms(permKey)));
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, perm);

        Assert.True(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task ChannelPermission_UserOverrideAllow_Grants(PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms()));  // role has nothing
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([
            new GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = ChannelId,
                UserId = UserId,
                Allow = true,
                PermissionId = Guid.NewGuid(),
                Permission = MakePerm(permKey, "Channel"),
            }
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, perm);

        Assert.True(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task ChannelPermission_UserOverrideDeny_Denies(PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms(permKey)));  // role grants it
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([
            new GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = ChannelId,
                UserId = UserId,
                Allow = false,
                PermissionId = Guid.NewGuid(),
                Permission = MakePerm(permKey, "Channel"),
            }
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, perm);

        Assert.False(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task ChannelPermission_RoleOverrideAllow_Grants(PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms()));  // role has nothing at guild level
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([
            new GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = ChannelId,
                RoleId = roleId,
                Allow = true,
                PermissionId = Guid.NewGuid(),
                Permission = MakePerm(permKey, "Channel"),
            }
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, perm);

        Assert.True(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task ChannelPermission_RoleOverrideDeny_Denies(PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms(permKey)));  // role grants at guild level
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([
            new GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = ChannelId,
                RoleId = roleId,
                Allow = false,
                PermissionId = Guid.NewGuid(),
                Permission = MakePerm(permKey, "Channel"),
            }
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, perm);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task ChannelPermission_UserOverride_TakesPriorityOverRoleOverride()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms()));
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([
            // Role denies
            new GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = ChannelId,
                RoleId = roleId,
                Allow = false,
                PermissionId = Guid.NewGuid(),
                Permission = MakePerm("SendMessages", "Channel"),
            },
            // User allows — should win
            new GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = ChannelId,
                UserId = UserId,
                Allow = true,
                PermissionId = Guid.NewGuid(),
                Permission = MakePerm("SendMessages", "Channel"),
            }
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.True(result.Allowed);
    }

    [Fact]
    public async Task ChannelPermission_NoOverrides_FallsBackToGuildPermission()
    {
        var roleId = Guid.NewGuid();
        // Role has guild-level SendMessages (as a Channel perm on the role)
        var member = MakeMember((roleId, ChannelPerms("SendMessages")));
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.True(result.Allowed);
    }

    // ────────────────────────────────────────────────────
    // TEST DATA
    // ────────────────────────────────────────────────────

    public static TheoryData<PermissionCapability, string> AllGuildPermissions => new()
    {
        { GuildPermission.ViewGuild, "ViewGuild" },
        { GuildPermission.ReadMessages, "ReadMessages" },
        { GuildPermission.ManageGuild, "ManageGuild" },
        { GuildPermission.ManageChannels, "ManageChannels" },
        { GuildPermission.ManageRoles, "ManageRoles" },
        { GuildPermission.InviteMembers, "InviteMembers" },
        { GuildPermission.KickMembers, "KickMembers" },
        { GuildPermission.BanMembers, "BanMembers" },
    };

    public static TheoryData<PermissionCapability, string> AllChannelPermissions => new()
    {
        { ChannelPermission.ViewChannel, "ViewChannel" },
        { ChannelPermission.ReadMessages, "ReadMessages" },
        { ChannelPermission.SendMessages, "SendMessages" },
        { ChannelPermission.SendAttachments, "SendAttachments" },
        { ChannelPermission.AddReactions, "AddReactions" },
        { ChannelPermission.ManageMessages, "ManageMessages" },
    };
}
