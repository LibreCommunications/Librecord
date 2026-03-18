using Librecord.Application.Realtime.Voice;

namespace Librecord.Tests.Voice;

public class VoiceEventsTests
{
    [Fact]
    public void VoiceUserJoined_CarriesUserInfo()
    {
        var evt = new VoiceUserJoined
        {
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Username = "alice",
            DisplayName = "Alice",
            AvatarUrl = "https://example.com/avatar.png"
        };

        Assert.Equal("alice", evt.Username);
        Assert.Equal("Alice", evt.DisplayName);
        Assert.NotNull(evt.AvatarUrl);
    }

    [Fact]
    public void VoiceUserLeft_HasRequiredIds()
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
    public void VoiceUserStateChanged_CarriesAllFlags()
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

    [Fact]
    public void VoiceUserJoined_IsVoiceEvent()
    {
        VoiceEvent evt = new VoiceUserJoined
        {
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Username = "test",
            DisplayName = "Test"
        };

        Assert.IsType<VoiceUserJoined>(evt);
    }

    [Fact]
    public void VoiceUserLeft_IsVoiceEvent()
    {
        VoiceEvent evt = new VoiceUserLeft
        {
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            UserId = Guid.NewGuid()
        };

        Assert.IsType<VoiceUserLeft>(evt);
    }
}
