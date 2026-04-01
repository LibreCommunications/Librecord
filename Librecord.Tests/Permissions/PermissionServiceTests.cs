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

    // --- Shared constants ---

    private static readonly Guid GuildId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid ChannelId = Guid.NewGuid();

    // --- Helpers ---

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

        var allPerms = roles.SelectMany(r => r.perms).Distinct().ToList();
        _guilds.Setup(g => g.GetRolesPermissionsBatchAsync(It.IsAny<IEnumerable<Guid>>()))
            .ReturnsAsync(allPerms);

        foreach (var (roleId, perms) in roles)
        {
            _guilds.Setup(g => g.GetRolePermissionsAsync(roleId))
                .ReturnsAsync(perms);
        }

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

    private void SetupChannelWithMember(GuildMember member, List<GuildChannelPermissionOverride> overrides)
    {
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);
        _guilds.Setup(g => g.GetChannelOverridesAsync(ChannelId)).ReturnsAsync(overrides);
    }

    private static GuildChannelPermissionOverride UserOverride(string permName, bool allow) =>
        new()
        {
            Id = Guid.NewGuid(),
            ChannelId = ChannelId,
            UserId = UserId,
            Allow = allow,
            PermissionId = Guid.NewGuid(),
            Permission = MakePerm(permName, "Channel"),
        };

    private static GuildChannelPermissionOverride RoleOverride(Guid roleId, string permName, bool allow) =>
        new()
        {
            Id = Guid.NewGuid(),
            ChannelId = ChannelId,
            RoleId = roleId,
            Allow = allow,
            PermissionId = Guid.NewGuid(),
            Permission = MakePerm(permName, "Channel"),
        };

    // ────────────────────────────────────────────────────
    // GUILD PERMISSION TESTS
    // ────────────────────────────────────────────────────

    [Fact]
    public async Task When_NonMember_ChecksGuildPermission_Should_Deny()
    {
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId))
            .ReturnsAsync((GuildMember?)null);

        var svc = CreateService();
        var result = await svc.HasGuildPermissionAsync(UserId, GuildId, GuildPermission.ViewGuild);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task When_MemberWithRole_ChecksGrantedPermission_Should_Allow()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, GuildPerms("ManageRoles")));
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);

        var svc = CreateService();
        var result = await svc.HasGuildPermissionAsync(UserId, GuildId, GuildPermission.ManageRoles);

        Assert.True(result.Allowed);
    }

    [Fact]
    public async Task When_MemberWithRole_ChecksUngrantedPermission_Should_Deny()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, GuildPerms("ViewGuild")));
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);

        var svc = CreateService();
        var result = await svc.HasGuildPermissionAsync(UserId, GuildId, GuildPermission.BanMembers);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task When_GetGrantedGuildPermissions_ForNonMember_Should_ReturnNull()
    {
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId))
            .ReturnsAsync((GuildMember?)null);

        var svc = CreateService();
        var result = await svc.GetGrantedGuildPermissionsAsync(UserId, GuildId);

        Assert.Null(result);
    }

    [Fact]
    public async Task When_GetGrantedGuildPermissions_ForMember_Should_ReturnAllRolePermissions()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, GuildPerms("ViewGuild", "ManageGuild", "KickMembers")));
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);

        var svc = CreateService();
        var result = await svc.GetGrantedGuildPermissionsAsync(UserId, GuildId);

        Assert.NotNull(result);
        Assert.Equal(3, result.Count);
        Assert.Contains(GuildPermission.ViewGuild, result);
        Assert.Contains(GuildPermission.ManageGuild, result);
        Assert.Contains(GuildPermission.KickMembers, result);
    }

    [Theory]
    [MemberData(nameof(AllGuildPermissions))]
    public async Task When_CheckingEachGuildPermission_WithGrantedRole_Should_Allow(
        PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, GuildPerms(permKey)));
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync(member);

        var svc = CreateService();
        var result = await svc.HasGuildPermissionAsync(UserId, GuildId, perm);

        Assert.True(result.Allowed);
    }

    // ────────────────────────────────────────────────────
    // CHANNEL PERMISSION TESTS - Override Precedence
    // ────────────────────────────────────────────────────

    [Fact]
    public async Task When_UserOverrideAllows_Should_GrantRegardlessOfRoleOverride()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms()));
        SetupChannelWithMember(member, [
            RoleOverride(roleId, "SendMessages", false),
            UserOverride("SendMessages", true),
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.True(result.Allowed);
    }

    [Fact]
    public async Task When_UserOverrideDenies_Should_DenyRegardlessOfRoleOverride()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms("SendMessages")));
        SetupChannelWithMember(member, [
            RoleOverride(roleId, "SendMessages", true),
            UserOverride("SendMessages", false),
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task When_RoleOverrideAllows_AndNoUserOverride_Should_Grant()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms()));
        SetupChannelWithMember(member, [
            RoleOverride(roleId, "SendMessages", true),
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.True(result.Allowed);
    }

    [Fact]
    public async Task When_RoleOverrideDenies_AndNoUserOverride_Should_Deny()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms("SendMessages")));
        SetupChannelWithMember(member, [
            RoleOverride(roleId, "SendMessages", false),
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task When_NoOverrides_Should_FallBackToGuildPermissions()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms("SendMessages")));
        SetupChannelWithMember(member, []);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.True(result.Allowed);
    }

    [Fact]
    public async Task When_ChannelNotFound_Should_Deny()
    {
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync((GuildChannel?)null);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task When_NonMember_ChecksChannelPermission_Should_Deny()
    {
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync((GuildMember?)null);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.False(result.Allowed);
    }

    [Fact]
    public async Task When_UserOverrideAllows_WithNoGuildGrant_Should_StillAllow()
    {
        var roleId = Guid.NewGuid();
        // Guild-level role does NOT grant ManageMessages
        var member = MakeMember((roleId, ChannelPerms("ViewChannel")));
        SetupChannelWithMember(member, [
            UserOverride("ManageMessages", true),
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.ManageMessages);

        Assert.True(result.Allowed);
    }

    [Fact]
    public async Task When_MultipleRoles_OneAllowsOneDoesNotOverride_Should_AllowFromOverride()
    {
        var roleA = Guid.NewGuid();
        var roleB = Guid.NewGuid();
        // Neither role grants SendMessages at guild level
        var member = MakeMember((roleA, ChannelPerms()), (roleB, ChannelPerms()));
        SetupChannelWithMember(member, [
            RoleOverride(roleA, "SendMessages", true),
            // roleB has no override for SendMessages
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        Assert.True(result.Allowed);
    }

    [Fact]
    public async Task When_MultipleRoles_OneAllowsOneDenies_Should_FollowFirstMatchBehavior()
    {
        // The service iterates member.Roles in order — first match wins
        var roleA = Guid.NewGuid();
        var roleB = Guid.NewGuid();
        var member = MakeMember((roleA, ChannelPerms()), (roleB, ChannelPerms()));
        SetupChannelWithMember(member, [
            RoleOverride(roleA, "SendMessages", true),
            RoleOverride(roleB, "SendMessages", false),
        ]);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, ChannelPermission.SendMessages);

        // HasChannelPermissionAsync: iterates roles, first override with Allow=true returns Allow
        Assert.True(result.Allowed);
    }

    [Theory]
    [MemberData(nameof(AllChannelPermissions))]
    public async Task When_CheckingEachChannelPermission_WithGuildGrant_Should_Allow(
        PermissionCapability perm, string permKey)
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms(permKey)));
        SetupChannelWithMember(member, []);

        var svc = CreateService();
        var result = await svc.HasChannelPermissionAsync(UserId, ChannelId, perm);

        Assert.True(result.Allowed);
    }

    // ────────────────────────────────────────────────────
    // BULK CHANNEL PERMISSIONS
    // ────────────────────────────────────────────────────

    [Fact]
    public async Task When_GetGrantedChannelPermissions_Should_ResolveAllChannelPermissions()
    {
        var roleId = Guid.NewGuid();
        var member = MakeMember((roleId, ChannelPerms(
            "ViewChannel", "ReadMessages", "SendMessages",
            "SendAttachments", "AddReactions", "ManageMessages")));
        SetupChannelWithMember(member, []);

        var svc = CreateService();
        var result = await svc.GetGrantedChannelPermissionsAsync(UserId, ChannelId);

        Assert.Equal(6, result.Count);
        Assert.Contains(ChannelPermission.ViewChannel, result);
        Assert.Contains(ChannelPermission.ReadMessages, result);
        Assert.Contains(ChannelPermission.SendMessages, result);
        Assert.Contains(ChannelPermission.SendAttachments, result);
        Assert.Contains(ChannelPermission.AddReactions, result);
        Assert.Contains(ChannelPermission.ManageMessages, result);
    }

    [Fact]
    public async Task When_GetGrantedChannelPermissions_WithMixedOverrides_Should_ApplyCorrectPrecedence()
    {
        var roleId = Guid.NewGuid();
        // Guild-level role grants SendMessages and ViewChannel
        var member = MakeMember((roleId, ChannelPerms("SendMessages", "ViewChannel")));
        SetupChannelWithMember(member, [
            // User override denies SendMessages (overrides guild grant)
            UserOverride("SendMessages", false),
            // Role override allows ReadMessages (no guild grant, but override adds it)
            RoleOverride(roleId, "ReadMessages", true),
            // Role override denies ViewChannel (overrides guild grant)
            RoleOverride(roleId, "ViewChannel", false),
        ]);

        var svc = CreateService();
        var result = await svc.GetGrantedChannelPermissionsAsync(UserId, ChannelId);

        Assert.DoesNotContain(ChannelPermission.SendMessages, result); // user override deny
        Assert.Contains(ChannelPermission.ReadMessages, result);       // role override allow
        Assert.DoesNotContain(ChannelPermission.ViewChannel, result);  // role override deny
    }

    [Fact]
    public async Task When_GetGrantedChannelPermissions_ForNonMember_Should_ReturnEmpty()
    {
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync(MakeChannel());
        _guilds.Setup(g => g.GetGuildMemberAsync(GuildId, UserId)).ReturnsAsync((GuildMember?)null);

        var svc = CreateService();
        var result = await svc.GetGrantedChannelPermissionsAsync(UserId, ChannelId);

        Assert.Empty(result);
    }

    [Fact]
    public async Task When_GetGrantedChannelPermissions_ChannelNotFound_Should_ReturnEmpty()
    {
        _guilds.Setup(g => g.GetChannelAsync(ChannelId)).ReturnsAsync((GuildChannel?)null);

        var svc = CreateService();
        var result = await svc.GetGrantedChannelPermissionsAsync(UserId, ChannelId);

        Assert.Empty(result);
    }

    // ────────────────────────────────────────────────────
    // SET CHANNEL OVERRIDE
    // ────────────────────────────────────────────────────

    [Fact]
    public async Task When_SettingOverride_WithAllowTrue_Should_CreateOrUpdate()
    {
        var permissionId = Guid.NewGuid();
        var roleId = Guid.NewGuid();

        // No existing override
        _guilds.Setup(g => g.GetChannelOverrideAsync(ChannelId, permissionId, roleId, null))
            .ReturnsAsync((GuildChannelPermissionOverride?)null);

        var svc = CreateService();
        await svc.SetChannelOverrideAsync(ChannelId, roleId, null, permissionId, true);

        _guilds.Verify(g => g.AddChannelOverrideAsync(
            It.Is<GuildChannelPermissionOverride>(o =>
                o.ChannelId == ChannelId &&
                o.RoleId == roleId &&
                o.PermissionId == permissionId &&
                o.Allow == true)),
            Times.Once);
        _guilds.Verify(g => g.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task When_SettingOverride_WithAllowNull_Should_RemoveExisting()
    {
        var permissionId = Guid.NewGuid();
        var existing = new GuildChannelPermissionOverride
        {
            Id = Guid.NewGuid(),
            ChannelId = ChannelId,
            RoleId = Guid.NewGuid(),
            PermissionId = permissionId,
            Allow = true,
        };

        _guilds.Setup(g => g.GetChannelOverrideAsync(ChannelId, permissionId, existing.RoleId, null))
            .ReturnsAsync(existing);

        var svc = CreateService();
        await svc.SetChannelOverrideAsync(ChannelId, existing.RoleId, null, permissionId, null);

        _guilds.Verify(g => g.RemoveChannelOverrideAsync(existing), Times.Once);
        _guilds.Verify(g => g.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task When_SettingOverride_WithExistingOverride_Should_UpdateInPlace()
    {
        var permissionId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        var existing = new GuildChannelPermissionOverride
        {
            Id = Guid.NewGuid(),
            ChannelId = ChannelId,
            RoleId = roleId,
            PermissionId = permissionId,
            Allow = true,
        };

        _guilds.Setup(g => g.GetChannelOverrideAsync(ChannelId, permissionId, roleId, null))
            .ReturnsAsync(existing);

        var svc = CreateService();
        await svc.SetChannelOverrideAsync(ChannelId, roleId, null, permissionId, false);

        // Should update existing, not create new
        Assert.Equal(false, existing.Allow);
        _guilds.Verify(g => g.AddChannelOverrideAsync(It.IsAny<GuildChannelPermissionOverride>()), Times.Never);
        _guilds.Verify(g => g.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task When_SettingOverride_WithAllowNull_AndNoExisting_Should_DoNothing()
    {
        var permissionId = Guid.NewGuid();
        var roleId = Guid.NewGuid();

        _guilds.Setup(g => g.GetChannelOverrideAsync(ChannelId, permissionId, roleId, null))
            .ReturnsAsync((GuildChannelPermissionOverride?)null);

        var svc = CreateService();
        await svc.SetChannelOverrideAsync(ChannelId, roleId, null, permissionId, null);

        _guilds.Verify(g => g.RemoveChannelOverrideAsync(It.IsAny<GuildChannelPermissionOverride>()), Times.Never);
        _guilds.Verify(g => g.SaveChangesAsync(), Times.Never);
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
