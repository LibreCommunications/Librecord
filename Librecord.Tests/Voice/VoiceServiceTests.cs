using Librecord.Application.Guilds;
using Librecord.Application.Messaging;
using Librecord.Application.Realtime.Voice;
using Librecord.Application.Voice;
using Librecord.Domain;
using Librecord.Domain.Guilds;
using Librecord.Domain.Identity;
using Librecord.Domain.Voice;
using Microsoft.Extensions.Options;
using Moq;

namespace Librecord.Tests.Voice;

public class VoiceServiceTests
{
    private readonly Mock<IVoiceStateRepository> _voiceStates = new();
    private readonly Mock<IGuildService> _guilds = new();
    private readonly Mock<IDirectMessageChannelService> _dmChannels = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ILiveKitTokenService> _tokenService = new();
    private readonly Mock<IVoiceRealtimeNotifier> _notifier = new();
    private readonly IOptions<LiveKitOptions> _options = Options.Create(new LiveKitOptions
    {
        Host = "ws://localhost:7880",
        ApiKey = "devkey",
        ApiSecret = "devsecret"
    });

    private static Mock<IUnitOfWork> MockUow()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.ExecuteInTransactionAsync(It.IsAny<Func<Task>>()))
            .Returns((Func<Task> action) => action());
        uow.Setup(u => u.SaveChangesAsync()).Returns(Task.CompletedTask);
        return uow;
    }

    private VoiceService CreateService() => new(
        _voiceStates.Object,
        _guilds.Object,
        _dmChannels.Object,
        _users.Object,
        _tokenService.Object,
        _notifier.Object,
        MockUow().Object,
        _options
    );

    private static User MakeUser(Guid id, string name = "testuser") => new()
    {
        Id = id,
        UserName = name,
        DisplayName = name
    };

    private static GuildChannel MakeVoiceChannel(Guid id, Guid guildId) => new()
    {
        Id = id,
        GuildId = guildId,
        Name = "voice-chat",
        Type = GuildChannelType.Voice,
        Position = 0,
        CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task When_JoiningVoiceChannelAsMember_Should_ReturnTokenAndParticipants()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var guildId = Guid.NewGuid();
        var user = MakeUser(userId);
        var channel = MakeVoiceChannel(channelId, guildId);

        _guilds.Setup(g => g.CanAccessChannelAsync(channelId, userId)).ReturnsAsync(true);
        _guilds.Setup(g => g.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _users.Setup(u => u.GetByIdAsync(userId)).ReturnsAsync(user);
        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync((VoiceState?)null);
        _voiceStates.Setup(v => v.GetByChannelIdAsync(channelId)).ReturnsAsync([]);
        _tokenService.Setup(t => t.GenerateToken(userId, "testuser", channelId)).Returns("jwt-token");
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>())).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.JoinVoiceChannelAsync(channelId, userId);

        Assert.Equal("jwt-token", result.Token);
        Assert.Equal("ws://localhost:7880", result.WsUrl);
        Assert.NotNull(result.Participants);
    }

    [Fact]
    public async Task When_JoiningVoiceChannelAsNonMember_Should_Reject()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        _guilds.Setup(g => g.CanAccessChannelAsync(channelId, userId)).ReturnsAsync(false);

        var svc = CreateService();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinVoiceChannelAsync(channelId, userId));

        Assert.Contains("access", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task When_LeavingVoiceChannel_Should_CleanUpState()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var guildId = Guid.NewGuid();

        var state = new VoiceState
        {
            UserId = userId,
            ChannelId = channelId,
            GuildId = guildId,
            JoinedAt = DateTime.UtcNow
        };

        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync(state);

        var svc = CreateService();
        await svc.LeaveVoiceChannelAsync(userId);

        _voiceStates.Verify(v => v.RemoveAsync(userId), Times.Once);
        _voiceStates.Verify(v => v.SaveChangesAsync(), Times.Once);
        _notifier.Verify(n => n.NotifyAsync(It.Is<VoiceUserLeft>(e =>
            e.ChannelId == channelId && e.UserId == userId
        )), Times.Once);
    }

    [Fact]
    public async Task When_UpdatingVoiceStateMute_Should_PersistMutedFlag()
    {
        var userId = Guid.NewGuid();
        var state = new VoiceState
        {
            UserId = userId,
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            IsMuted = false,
            IsDeafened = false,
            IsCameraOn = false,
            IsScreenSharing = false,
            JoinedAt = DateTime.UtcNow
        };

        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync(state);

        var svc = CreateService();
        await svc.UpdateVoiceStateAsync(userId, new VoiceStateUpdateDto { IsMuted = true });

        Assert.True(state.IsMuted);
        _voiceStates.Verify(v => v.UpdateAsync(state), Times.Once);
    }

    [Fact]
    public async Task When_UpdatingVoiceStateDeafenCameraScreenshare_Should_PersistAllFlags()
    {
        var userId = Guid.NewGuid();
        var state = new VoiceState
        {
            UserId = userId,
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            JoinedAt = DateTime.UtcNow
        };

        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync(state);

        var svc = CreateService();
        await svc.UpdateVoiceStateAsync(userId, new VoiceStateUpdateDto
        {
            IsDeafened = true,
            IsCameraOn = true,
            IsScreenSharing = true
        });

        Assert.True(state.IsDeafened);
        Assert.True(state.IsCameraOn);
        Assert.True(state.IsScreenSharing);
    }

    [Fact]
    public async Task When_SwitchingChannels_Should_LeaveOldAndJoinNew()
    {
        var userId = Guid.NewGuid();
        var oldChannelId = Guid.NewGuid();
        var newChannelId = Guid.NewGuid();
        var guildId = Guid.NewGuid();
        var user = MakeUser(userId);
        var channel = MakeVoiceChannel(newChannelId, guildId);

        var existingState = new VoiceState
        {
            UserId = userId,
            ChannelId = oldChannelId,
            GuildId = guildId,
            JoinedAt = DateTime.UtcNow.AddMinutes(-5)
        };

        _guilds.Setup(g => g.CanAccessChannelAsync(newChannelId, userId)).ReturnsAsync(true);
        _guilds.Setup(g => g.GetChannelAsync(newChannelId)).ReturnsAsync(channel);
        _users.Setup(u => u.GetByIdAsync(userId)).ReturnsAsync(user);
        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync(existingState);
        _voiceStates.Setup(v => v.GetByChannelIdAsync(newChannelId)).ReturnsAsync([]);
        _tokenService.Setup(t => t.GenerateToken(userId, It.IsAny<string>(), newChannelId)).Returns("token");
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>())).ReturnsAsync([]);

        var svc = CreateService();
        await svc.JoinVoiceChannelAsync(newChannelId, userId);

        _notifier.Verify(n => n.NotifyAsync(It.Is<VoiceUserLeft>(e =>
            e.ChannelId == oldChannelId && e.UserId == userId
        )), Times.Once);

        _notifier.Verify(n => n.NotifyAsync(It.Is<VoiceUserJoined>(e =>
            e.ChannelId == newChannelId && e.UserId == userId
        )), Times.Once);
    }

    [Fact]
    public async Task When_GettingParticipants_Should_ReturnCurrentUsersInChannel()
    {
        var channelId = Guid.NewGuid();
        var user1Id = Guid.NewGuid();
        var user2Id = Guid.NewGuid();

        var states = new List<VoiceState>
        {
            new()
            {
                UserId = user1Id, ChannelId = channelId, GuildId = Guid.NewGuid(),
                IsMuted = true, JoinedAt = DateTime.UtcNow.AddMinutes(-2)
            },
            new()
            {
                UserId = user2Id, ChannelId = channelId, GuildId = Guid.NewGuid(),
                IsCameraOn = true, JoinedAt = DateTime.UtcNow
            },
        };

        var users = new List<User>
        {
            MakeUser(user1Id, "alice"),
            MakeUser(user2Id, "bob"),
        };

        _voiceStates.Setup(v => v.GetByChannelIdAsync(channelId)).ReturnsAsync(states);
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>())).ReturnsAsync(users);

        var svc = CreateService();
        var result = await svc.GetChannelParticipantsAsync(channelId);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, p => p.Username == "alice" && p.IsMuted);
        Assert.Contains(result, p => p.Username == "bob" && p.IsCameraOn);
    }

    [Fact]
    public async Task When_JoiningDmVoiceCall_Should_ReturnToken()
    {
        var userId = Guid.NewGuid();
        var dmChannelId = Guid.NewGuid();
        var user = MakeUser(userId);

        _dmChannels.Setup(d => d.IsMemberAsync(dmChannelId, userId)).ReturnsAsync(true);
        _users.Setup(u => u.GetByIdAsync(userId)).ReturnsAsync(user);
        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync((VoiceState?)null);
        _voiceStates.Setup(v => v.GetByChannelIdAsync(dmChannelId)).ReturnsAsync([]);
        _tokenService.Setup(t => t.GenerateToken(userId, "testuser", dmChannelId)).Returns("dm-token");
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>())).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.JoinDmVoiceCallAsync(dmChannelId, userId);

        Assert.Equal("dm-token", result.Token);
        Assert.Equal("ws://localhost:7880", result.WsUrl);
    }
}
