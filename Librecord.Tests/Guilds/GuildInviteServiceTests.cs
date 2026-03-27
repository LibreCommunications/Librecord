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
        uow.Setup(u => u.BeginTransactionAsync()).ReturnsAsync(Mock.Of<IAsyncDisposable>());
        uow.Setup(u => u.CommitAsync()).Returns(Task.CompletedTask);
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
    public async Task CreateInvite_Success_PersistsInvite()
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
        var result = await svc.CreateInviteAsync(guildId, creatorId, maxUses: 10);

        Assert.Equal(guildId, result.GuildId);
        _invites.Verify(i => i.AddAsync(It.Is<GuildInvite>(inv =>
            inv.GuildId == guildId &&
            inv.CreatorId == creatorId &&
            inv.MaxUses == 10 &&
            inv.Code.Length == 8 &&
            inv.ExpiresAt.HasValue
        )), Times.Once);
    }

    [Fact]
    public async Task CreateInvite_NoExpiration_DefaultsTo7Days()
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

        var before = DateTime.UtcNow.AddDays(7).AddSeconds(-5);
        var svc = CreateService();
        await svc.CreateInviteAsync(guildId, creatorId);
        var after = DateTime.UtcNow.AddDays(7).AddSeconds(5);

        _invites.Verify(i => i.AddAsync(It.Is<GuildInvite>(inv =>
            inv.ExpiresAt.HasValue &&
            inv.ExpiresAt.Value >= before &&
            inv.ExpiresAt.Value <= after
        )), Times.Once);
    }

    [Fact]
    public async Task CreateInvite_GuildNotFound_Throws()
    {
        _guilds.Setup(g => g.GetGuildAsync(It.IsAny<Guid>())).ReturnsAsync((Guild?)null);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CreateInviteAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task CreateInvite_NotAMember_Throws()
    {
        var guildId = Guid.NewGuid();
        _guilds.Setup(g => g.GetGuildAsync(guildId)).ReturnsAsync(MakeGuild(guildId));
        _guilds.Setup(g => g.GetGuildMemberAsync(guildId, It.IsAny<Guid>()))
            .ReturnsAsync((GuildMember?)null);

        var svc = CreateService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.CreateInviteAsync(guildId, Guid.NewGuid()));
    }

    // ---------------------------------------------------------
    // JOIN BY CODE
    // ---------------------------------------------------------

    [Fact]
    public async Task JoinByCode_ValidInvite_AddsMember()
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
        _guilds.Setup(g => g.GetGuildAsync(guildId)).ReturnsAsync(guild);

        var svc = CreateService();
        var result = await svc.JoinByCodeAsync("ABCD1234", userId);

        Assert.Equal(guildId, result.Id);
        Assert.Single(guild.Members);
        Assert.Equal(1, invite.UsesCount);
    }

    [Fact]
    public async Task JoinByCode_InvalidCode_Throws()
    {
        _invites.Setup(i => i.GetByCodeAsync("INVALID")).ReturnsAsync((GuildInvite?)null);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinByCodeAsync("INVALID", Guid.NewGuid()));
        Assert.Contains("Invalid invite", ex.Message);
    }

    [Fact]
    public async Task JoinByCode_ExpiredInvite_Throws()
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
    public async Task JoinByCode_MaxUsesReached_Throws()
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
    public async Task JoinByCode_AlreadyMember_Throws()
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
        _guilds.Setup(g => g.GetGuildMemberAsync(guildId, userId))
            .ReturnsAsync(new GuildMember { GuildId = guildId, UserId = userId });

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinByCodeAsync("JOIN1234", userId));
        Assert.Contains("Already a member", ex.Message);
    }

    // ---------------------------------------------------------
    // REVOKE INVITE
    // ---------------------------------------------------------

    [Fact]
    public async Task RevokeInvite_ValidMember_Deletes()
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
        _invites.Verify(i => i.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task RevokeInvite_NotAMember_Throws()
    {
        var invite = new GuildInvite
        {
            Id = Guid.NewGuid(),
            Code = "NOACCESS",
            GuildId = Guid.NewGuid(),
            CreatorId = Guid.NewGuid()
        };

        _invites.Setup(i => i.GetByIdAsync(invite.Id)).ReturnsAsync(invite);
        _guilds.Setup(g => g.GetGuildMemberAsync(invite.GuildId, It.IsAny<Guid>()))
            .ReturnsAsync((GuildMember?)null);

        var svc = CreateService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.RevokeInviteAsync(invite.Id, Guid.NewGuid()));
    }
}
