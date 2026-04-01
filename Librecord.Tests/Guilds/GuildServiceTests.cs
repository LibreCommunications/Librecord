using Librecord.Application.Guilds;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Moq;

namespace Librecord.Tests.Guilds;

public class GuildServiceTests
{
    private readonly Mock<IGuildRepository> _guilds = new();
    private readonly Mock<IPermissionService> _permissions = new();

    private GuildService CreateService() => new(_guilds.Object, _permissions.Object);

    // ---------------------------------------------------------
    // CREATE GUILD
    // ---------------------------------------------------------

    [Fact]
    public async Task When_CreatingGuild_Should_AssignOwnerAndCreateEveryoneAndOwnerRoles()
    {
        var ownerId = Guid.NewGuid();

        var svc = CreateService();
        var guild = await svc.CreateGuildAsync(ownerId, "Test Guild");

        Assert.Equal("Test Guild", guild.Name);
        Assert.Equal(ownerId, guild.OwnerId);
        Assert.Equal(2, guild.Roles.Count);
        Assert.Contains(guild.Roles, r => r.Name == "@everyone");
        Assert.Contains(guild.Roles, r => r.Name == "Owner");
        Assert.Single(guild.Members);
        Assert.Equal(ownerId, guild.Members.First().UserId);
    }

    [Fact]
    public async Task When_CreatingGuild_Should_GrantDefaultPermissionsToEveryone()
    {
        var svc = CreateService();
        var guild = await svc.CreateGuildAsync(Guid.NewGuid(), "Test");

        var everyoneRole = guild.Roles.First(r => r.Name == "@everyone");

        Assert.NotEmpty(everyoneRole.Permissions);
        Assert.Contains(everyoneRole.Permissions, rp => rp.PermissionId == PermissionIds.ChannelSendMessages && rp.Allow);
        Assert.Contains(everyoneRole.Permissions, rp => rp.PermissionId == PermissionIds.ChannelReadMessages && rp.Allow);
        Assert.Contains(everyoneRole.Permissions, rp => rp.PermissionId == PermissionIds.GuildViewGuild && rp.Allow);
    }

    [Fact]
    public async Task When_CreatingGuild_Should_GrantAllPermissionsToOwnerRole()
    {
        var svc = CreateService();
        var guild = await svc.CreateGuildAsync(Guid.NewGuid(), "Test");

        var ownerRole = guild.Roles.First(r => r.Name == "Owner");

        foreach (var perm in KnownPermissions.All)
            Assert.Contains(ownerRole.Permissions, rp => rp.PermissionId == perm.Id && rp.Allow);
    }

    // ---------------------------------------------------------
    // IS MEMBER
    // ---------------------------------------------------------

    [Fact]
    public async Task When_CheckingMembershipForMember_Should_ReturnTrue()
    {
        var guildId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        _guilds.Setup(g => g.GetGuildMemberAsync(guildId, userId))
            .ReturnsAsync(new GuildMember { GuildId = guildId, UserId = userId });

        var svc = CreateService();
        Assert.True(await svc.IsMemberAsync(guildId, userId));
    }

    [Fact]
    public async Task When_CheckingMembershipForNonMember_Should_ReturnFalse()
    {
        _guilds.Setup(g => g.GetGuildMemberAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync((GuildMember?)null);

        var svc = CreateService();
        Assert.False(await svc.IsMemberAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    // ---------------------------------------------------------
    // CAN ACCESS CHANNEL
    // ---------------------------------------------------------

    [Fact]
    public async Task When_CheckingChannelAccessForMember_Should_Allow()
    {
        var channelId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        _permissions.Setup(p => p.HasChannelPermissionAsync(userId, channelId, ChannelPermission.ReadMessages))
            .ReturnsAsync(PermissionResult.Allow());

        var svc = CreateService();
        Assert.True(await svc.CanAccessChannelAsync(channelId, userId));
    }
}
