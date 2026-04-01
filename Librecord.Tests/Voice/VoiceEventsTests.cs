using Librecord.Application.Realtime.Voice;

namespace Librecord.Tests.Voice;

public class VoiceEventsTests
{
    [Fact]
    public void When_VoiceUserJoinedEventCreated_Should_ContainAllRequiredFields()
    {
        var channelId = Guid.NewGuid();
        var guildId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var evt = new VoiceUserJoined
        {
            ChannelId = channelId,
            GuildId = guildId,
            UserId = userId,
            Username = "alice",
            DisplayName = "Alice",
            AvatarUrl = "https://example.com/avatar.png",
            IsMuted = false,
            IsDeafened = false,
            IsCameraOn = true,
            IsScreenSharing = false
        };

        Assert.Equal(channelId, evt.ChannelId);
        Assert.Equal(guildId, evt.GuildId);
        Assert.Equal(userId, evt.UserId);
        Assert.Equal("alice", evt.Username);
        Assert.Equal("Alice", evt.DisplayName);
        Assert.Equal("https://example.com/avatar.png", evt.AvatarUrl);
        Assert.True(evt.IsCameraOn);
    }

    [Fact]
    public void When_VoiceUserLeftEventCreated_Should_ContainUserIdAndChannelId()
    {
        var channelId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var evt = new VoiceUserLeft
        {
            ChannelId = channelId,
            GuildId = Guid.NewGuid(),
            UserId = userId
        };

        Assert.Equal(channelId, evt.ChannelId);
        Assert.Equal(userId, evt.UserId);
    }

    [Fact]
    public void When_VoiceStateChangedEventCreated_Should_ContainAllStateFlags()
    {
        var evt = new VoiceUserStateChanged
        {
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            IsMuted = true,
            IsDeafened = false,
            IsCameraOn = true,
            IsScreenSharing = true
        };

        Assert.True(evt.IsMuted);
        Assert.False(evt.IsDeafened);
        Assert.True(evt.IsCameraOn);
        Assert.True(evt.IsScreenSharing);
    }
}
