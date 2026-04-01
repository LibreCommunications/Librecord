using Librecord.Application.Guilds;
using Librecord.Domain;
using Librecord.Domain.Guilds;
using Moq;

namespace Librecord.Tests.Guilds;

public class GuildInviteServiceTests
{
    private readonly Mock<IGuildInviteRepository> _invites = new();
    private readonly Mock<IGuildRepository> _guilds = new();

    private static Mock<IUnitOfWork> MockUow()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.ExecuteInTransactionAsync(It.IsAny<Func<Task>>()))
            .Returns((Func<Task> action) => action());
        uow.Setup(u => u.SaveChangesAsync()).Returns(Task.CompletedTask);
        return uow;
    }

    private GuildInviteService CreateService() => new(_invites.Object, _guilds.Object, MockUow().Object);

    private static Guild MakeGuild(Guid? id = null)
    {
        var guildId = id ?? Guid.NewGuid();
        return new Guild
        {
            Id = guildId,
            Name = "Test Guild",
            CreatedAt = DateTime.UtcNow,
            Roles =
            {
                new GuildRole
                {
                    Id = Guid.NewGuid(),
                    GuildId = guildId,
                    Name = "@everyone"
                }
            }
        };
    }

    // ---------------------------------------------------------
    // CREATE INVITE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_CreatingInvite_Should_GenerateUniqueCode()
    {
        var guildId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var guild = MakeGuild(guildId);
        var member = new GuildMember { GuildId = guildId, UserId = creatorId };

        _guilds.Setup(g => g.GetGuildAsync(guildId)).ReturnsAsync(guild);
        _guilds.Setup(g => g.GetGuildMemberAsync(guildId, creatorId)).ReturnsAsync(member);
        _invites.Setup(i => i.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => new GuildInvite
            {
                Id = id,
                Code = "ABCD1234",
                GuildId = guildId,
                CreatorId = creatorId,
                CreatedAt = DateTime.UtcNow
            });

        var svc = CreateService();
        var result = await svc.CreateInviteAsync(guildId, creatorId);

        Assert.Equal(guildId, result.GuildId);
        _invites.Verify(i => i.AddAsync(It.Is<GuildInvite>(inv =>
            inv.GuildId == guildId &&
            inv.Code.Length == 8
        )), Times.Once);
    }

    // ---------------------------------------------------------
    // JOIN BY CODE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_JoiningWithValidInvite_Should_AddMemberWithEveryoneRole()
    {
        var guildId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var guild = MakeGuild(guildId);
        var invite = new GuildInvite
        {
            Id = Guid.NewGuid(),
            Code = "ABCD1234",
            GuildId = guildId,
            CreatorId = Guid.NewGuid(),
            MaxUses = 10,
            UsesCount = 0
        };

        _invites.Setup(i => i.GetByCodeAsync("ABCD1234")).ReturnsAsync(invite);
        _guilds.Setup(g => g.GetGuildMemberAsync(guildId, userId)).ReturnsAsync((GuildMember?)null);
        _guilds.Setup(g => g.GetBanAsync(guildId, userId)).ReturnsAsync((GuildBan?)null);
        _guilds.Setup(g => g.GetGuildAsync(guildId)).ReturnsAsync(guild);

        var svc = CreateService();
        var result = await svc.JoinByCodeAsync("ABCD1234", userId);

        Assert.Equal(guildId, result.Id);
        Assert.Single(guild.Members);
        var newMember = guild.Members.First();
        Assert.Equal(userId, newMember.UserId);
        Assert.Single(newMember.Roles);
        Assert.Equal(1, invite.UsesCount);
    }

    [Fact]
    public async Task When_JoiningWithExpiredInvite_Should_Reject()
    {
        var invite = new GuildInvite
        {
            Id = Guid.NewGuid(),
            Code = "EXPIRED1",
            GuildId = Guid.NewGuid(),
            CreatorId = Guid.NewGuid(),
            ExpiresAt = DateTime.UtcNow.AddDays(-1)
        };

        _invites.Setup(i => i.GetByCodeAsync("EXPIRED1")).ReturnsAsync(invite);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinByCodeAsync("EXPIRED1", Guid.NewGuid()));
        Assert.Contains("expired", ex.Message);
    }

    [Fact]
    public async Task When_JoiningWithMaxedOutInvite_Should_Reject()
    {
        var invite = new GuildInvite
        {
            Id = Guid.NewGuid(),
            Code = "MAXED123",
            GuildId = Guid.NewGuid(),
            CreatorId = Guid.NewGuid(),
            MaxUses = 5,
            UsesCount = 5
        };

        _invites.Setup(i => i.GetByCodeAsync("MAXED123")).ReturnsAsync(invite);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinByCodeAsync("MAXED123", Guid.NewGuid()));
        Assert.Contains("max uses", ex.Message);
    }

    [Fact]
    public async Task When_AlreadyMemberJoining_Should_Reject()
    {
        var guildId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var invite = new GuildInvite
        {
            Id = Guid.NewGuid(),
            Code = "JOIN1234",
            GuildId = guildId,
            CreatorId = Guid.NewGuid()
        };

        _invites.Setup(i => i.GetByCodeAsync("JOIN1234")).ReturnsAsync(invite);
        _guilds.Setup(g => g.GetBanAsync(guildId, userId)).ReturnsAsync((GuildBan?)null);
        _guilds.Setup(g => g.GetGuildMemberAsync(guildId, userId))
            .ReturnsAsync(new GuildMember { GuildId = guildId, UserId = userId });

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinByCodeAsync("JOIN1234", userId));
        Assert.Contains("Already a member", ex.Message);
    }

    [Fact]
    public async Task When_BannedUserJoining_Should_Reject()
    {
        var guildId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var invite = new GuildInvite
        {
            Id = Guid.NewGuid(),
            Code = "BANNED12",
            GuildId = guildId,
            CreatorId = Guid.NewGuid()
        };

        _invites.Setup(i => i.GetByCodeAsync("BANNED12")).ReturnsAsync(invite);
        _guilds.Setup(g => g.GetBanAsync(guildId, userId))
            .ReturnsAsync(new GuildBan { GuildId = guildId, UserId = userId });

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinByCodeAsync("BANNED12", userId));
        Assert.Contains("banned", ex.Message);
    }

    // ---------------------------------------------------------
    // REVOKE INVITE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_RevokingInvite_Should_RemoveIt()
    {
        var guildId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var inviteId = Guid.NewGuid();
        var invite = new GuildInvite
        {
            Id = inviteId,
            Code = "REVOKE12",
            GuildId = guildId,
            CreatorId = Guid.NewGuid()
        };

        _invites.Setup(i => i.GetByIdAsync(inviteId)).ReturnsAsync(invite);
        _guilds.Setup(g => g.GetGuildMemberAsync(guildId, userId))
            .ReturnsAsync(new GuildMember { GuildId = guildId, UserId = userId });

        var svc = CreateService();
        await svc.RevokeInviteAsync(inviteId, userId);

        _invites.Verify(i => i.DeleteAsync(inviteId), Times.Once);
    }
}
