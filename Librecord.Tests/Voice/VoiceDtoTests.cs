using Librecord.Application.Voice;

namespace Librecord.Tests.Voice;

public class VoiceDtoTests
{
    [Fact]
    public void VoiceStateUpdateDto_NullableFields_AllNullByDefault()
    {
        var dto = new VoiceStateUpdateDto();

        Assert.Null(dto.IsMuted);
        Assert.Null(dto.IsDeafened);
        Assert.Null(dto.IsCameraOn);
        Assert.Null(dto.IsScreenSharing);
    }

    [Fact]
    public void VoiceStateUpdateDto_PartialSet()
    {
        var dto = new VoiceStateUpdateDto { IsMuted = true, IsCameraOn = false };

        Assert.True(dto.IsMuted);
        Assert.False(dto.IsCameraOn);
        Assert.Null(dto.IsDeafened);
        Assert.Null(dto.IsScreenSharing);
    }

    [Fact]
    public void VoiceJoinResult_HoldsTokenAndUrl()
    {
        var result = new VoiceJoinResult
        {
            Token = "jwt-token",
            WsUrl = "ws://localhost:7880",
            Participants = []
        };

        Assert.Equal("jwt-token", result.Token);
        Assert.Equal("ws://localhost:7880", result.WsUrl);
        Assert.Empty(result.Participants);
    }

    [Fact]
    public void VoiceParticipantDto_MapsAllFields()
    {
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var dto = new VoiceParticipantDto
        {
            UserId = id,
            Username = "alice",
            DisplayName = "Alice",
            AvatarUrl = null,
            IsMuted = true,
            IsDeafened = false,
            IsCameraOn = true,
            IsScreenSharing = false,
            JoinedAt = now
        };

        Assert.Equal(id, dto.UserId);
        Assert.Equal("alice", dto.Username);
        Assert.True(dto.IsMuted);
        Assert.True(dto.IsCameraOn);
        Assert.Equal(now, dto.JoinedAt);
    }
}
