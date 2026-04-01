using Librecord.Application.Voice;

namespace Librecord.Tests.Voice;

public class VoiceDtoTests
{
    [Fact]
    public void When_CreatingVoiceStateUpdateDto_Should_DefaultNullableFieldsToNull()
    {
        var dto = new VoiceStateUpdateDto();

        Assert.Null(dto.IsMuted);
        Assert.Null(dto.IsDeafened);
        Assert.Null(dto.IsCameraOn);
        Assert.Null(dto.IsScreenSharing);
    }

    [Fact]
    public void When_CreatingVoiceJoinResult_Should_ContainTokenAndWsUrl()
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
    public void When_CreatingVoiceParticipantDto_Should_MapAllFields()
    {
        var id = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var dto = new VoiceParticipantDto
        {
            UserId = id,
            Username = "alice",
            DisplayName = "Alice",
            AvatarUrl = "https://example.com/avatar.png",
            IsMuted = true,
            IsDeafened = false,
            IsCameraOn = true,
            IsScreenSharing = false,
            JoinedAt = now
        };

        Assert.Equal(id, dto.UserId);
        Assert.Equal("alice", dto.Username);
        Assert.Equal("Alice", dto.DisplayName);
        Assert.Equal("https://example.com/avatar.png", dto.AvatarUrl);
        Assert.True(dto.IsMuted);
        Assert.False(dto.IsDeafened);
        Assert.True(dto.IsCameraOn);
        Assert.False(dto.IsScreenSharing);
        Assert.Equal(now, dto.JoinedAt);
    }
}
