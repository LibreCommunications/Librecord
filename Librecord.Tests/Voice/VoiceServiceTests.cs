using Librecord.Application.Guilds;
using Librecord.Application.Realtime.Voice;
using Librecord.Application.Voice;
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
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ILiveKitTokenService> _tokenService = new();
    private readonly Mock<IVoiceRealtimeNotifier> _notifier = new();
    private readonly IOptions<LiveKitOptions> _options = Options.Create(new LiveKitOptions
    {
        Host = "ws://localhost:7880",
        ApiKey = "devkey",
        ApiSecret = "devsecret"
    });

    private VoiceService CreateService() => new(
        _voiceStates.Object,
        _guilds.Object,
        _users.Object,
        _tokenService.Object,
        _notifier.Object,
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

    // ─── JoinVoiceChannelAsync ──────────────────────────────────────

    [Fact]
    public async Task JoinVoiceChannel_Success_ReturnsTokenAndParticipants()
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
        _voiceStates.Verify(v => v.AddAsync(It.Is<VoiceState>(s =>
            s.UserId == userId && s.ChannelId == channelId && s.GuildId == guildId
        )), Times.Once);
        _voiceStates.Verify(v => v.SaveChangesAsync(), Times.AtLeastOnce);
        _notifier.Verify(n => n.NotifyAsync(It.IsAny<VoiceUserJoined>()), Times.Once);
    }

    [Fact]
    public async Task JoinVoiceChannel_NoAccess_Throws()
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
    public async Task JoinVoiceChannel_ChannelNotFound_Throws()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        _guilds.Setup(g => g.CanAccessChannelAsync(channelId, userId)).ReturnsAsync(true);
        _guilds.Setup(g => g.GetChannelAsync(channelId)).ReturnsAsync((GuildChannel?)null);

        var svc = CreateService();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinVoiceChannelAsync(channelId, userId));

        Assert.Contains("not found", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task JoinVoiceChannel_TextChannel_Throws()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = new GuildChannel
        {
            Id = channelId,
            GuildId = Guid.NewGuid(),
            Name = "general",
            Type = GuildChannelType.Text,
            Position = 0,
            CreatedAt = DateTime.UtcNow
        };

        _guilds.Setup(g => g.CanAccessChannelAsync(channelId, userId)).ReturnsAsync(true);
        _guilds.Setup(g => g.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinVoiceChannelAsync(channelId, userId));

        Assert.Contains("not a voice channel", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task JoinVoiceChannel_UserNotFound_Throws()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeVoiceChannel(channelId, Guid.NewGuid());

        _guilds.Setup(g => g.CanAccessChannelAsync(channelId, userId)).ReturnsAsync(true);
        _guilds.Setup(g => g.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _users.Setup(u => u.GetByIdAsync(userId)).ReturnsAsync((User?)null);

        var svc = CreateService();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.JoinVoiceChannelAsync(channelId, userId));

        Assert.Contains("User not found", ex.Message);
    }

    [Fact]
    public async Task JoinVoiceChannel_AlreadyInChannel_LeavesOldFirst()
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

        // Should have left old channel (VoiceUserLeft for old channel)
        _notifier.Verify(n => n.NotifyAsync(It.Is<VoiceUserLeft>(e =>
            e.ChannelId == oldChannelId && e.UserId == userId
        )), Times.Once);

        // Should have joined new channel
        _notifier.Verify(n => n.NotifyAsync(It.Is<VoiceUserJoined>(e =>
            e.ChannelId == newChannelId && e.UserId == userId
        )), Times.Once);
    }

    // ─── LeaveVoiceChannelAsync ─────────────────────────────────────

    [Fact]
    public async Task LeaveVoiceChannel_InChannel_RemovesAndNotifies()
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
            e.ChannelId == channelId && e.GuildId == guildId && e.UserId == userId
        )), Times.Once);
    }

    [Fact]
    public async Task LeaveVoiceChannel_NotInChannel_DoesNothing()
    {
        var userId = Guid.NewGuid();
        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync((VoiceState?)null);

        var svc = CreateService();
        await svc.LeaveVoiceChannelAsync(userId);

        _voiceStates.Verify(v => v.RemoveAsync(It.IsAny<Guid>()), Times.Never);
        _notifier.Verify(n => n.NotifyAsync(It.IsAny<VoiceEvent>()), Times.Never);
    }

    // ─── UpdateVoiceStateAsync ──────────────────────────────────────

    [Fact]
    public async Task UpdateVoiceState_MuteToggle_UpdatesAndBroadcasts()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var guildId = Guid.NewGuid();

        var state = new VoiceState
        {
            UserId = userId,
            ChannelId = channelId,
            GuildId = guildId,
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
        _voiceStates.Verify(v => v.SaveChangesAsync(), Times.Once);
        _notifier.Verify(n => n.NotifyAsync(It.Is<VoiceUserStateChanged>(e =>
            e.UserId == userId && e.IsMuted == true
        )), Times.Once);
    }

    [Fact]
    public async Task UpdateVoiceState_PartialUpdate_OnlyChangesSpecifiedFields()
    {
        var userId = Guid.NewGuid();
        var state = new VoiceState
        {
            UserId = userId,
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            IsMuted = false,
            IsDeafened = false,
            IsCameraOn = true,
            IsScreenSharing = false,
            JoinedAt = DateTime.UtcNow
        };

        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync(state);

        var svc = CreateService();
        await svc.UpdateVoiceStateAsync(userId, new VoiceStateUpdateDto { IsScreenSharing = true });

        Assert.False(state.IsMuted);
        Assert.True(state.IsCameraOn);
        Assert.True(state.IsScreenSharing);
    }

    [Fact]
    public async Task UpdateVoiceState_NotInChannel_DoesNothing()
    {
        var userId = Guid.NewGuid();
        _voiceStates.Setup(v => v.GetByUserIdAsync(userId)).ReturnsAsync((VoiceState?)null);

        var svc = CreateService();
        await svc.UpdateVoiceStateAsync(userId, new VoiceStateUpdateDto { IsMuted = true });

        _voiceStates.Verify(v => v.UpdateAsync(It.IsAny<VoiceState>()), Times.Never);
        _notifier.Verify(n => n.NotifyAsync(It.IsAny<VoiceEvent>()), Times.Never);
    }

    // ─── GetChannelParticipantsAsync ────────────────────────────────

    [Fact]
    public async Task GetChannelParticipants_Empty_ReturnsEmptyList()
    {
        var channelId = Guid.NewGuid();
        _voiceStates.Setup(v => v.GetByChannelIdAsync(channelId)).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.GetChannelParticipantsAsync(channelId);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetChannelParticipants_WithUsers_ReturnsMappedDtos()
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
        Assert.Equal("alice", result[0].Username);
        Assert.True(result[0].IsMuted);
        Assert.Equal("bob", result[1].Username);
        Assert.True(result[1].IsCameraOn);
    }

    [Fact]
    public async Task GetChannelParticipants_MissingUser_FallsBackToUnknown()
    {
        var channelId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var states = new List<VoiceState>
        {
            new()
            {
                UserId = userId, ChannelId = channelId, GuildId = Guid.NewGuid(),
                JoinedAt = DateTime.UtcNow
            }
        };

        _voiceStates.Setup(v => v.GetByChannelIdAsync(channelId)).ReturnsAsync(states);
        _users.Setup(u => u.GetByIdsAsync(It.IsAny<IEnumerable<Guid>>())).ReturnsAsync([]);

        var svc = CreateService();
        var result = await svc.GetChannelParticipantsAsync(channelId);

        Assert.Single(result);
        Assert.Equal("Unknown", result[0].Username);
        Assert.Equal("Unknown", result[0].DisplayName);
    }
}
