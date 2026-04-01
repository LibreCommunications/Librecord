using Librecord.Domain.Voice;

namespace Librecord.Tests.Voice;

public class VoiceStateEntityTests
{
    [Fact]
    public void When_VoiceStateCreated_Should_DefaultAllFlagsToFalse()
    {
        var state = new VoiceState
        {
            UserId = Guid.NewGuid(),
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            JoinedAt = DateTime.UtcNow
        };

        Assert.False(state.IsMuted);
        Assert.False(state.IsDeafened);
        Assert.False(state.IsCameraOn);
        Assert.False(state.IsScreenSharing);
    }

    [Fact]
    public void When_TogglingStateFlags_Should_UpdateCorrectly()
    {
        var state = new VoiceState
        {
            UserId = Guid.NewGuid(),
            ChannelId = Guid.NewGuid(),
            GuildId = Guid.NewGuid(),
            JoinedAt = DateTime.UtcNow
        };

        state.IsMuted = true;
        state.IsCameraOn = true;

        Assert.True(state.IsMuted);
        Assert.True(state.IsCameraOn);
        Assert.False(state.IsDeafened);
        Assert.False(state.IsScreenSharing);

        state.IsMuted = false;
        state.IsScreenSharing = true;

        Assert.False(state.IsMuted);
        Assert.True(state.IsScreenSharing);
    }
}
