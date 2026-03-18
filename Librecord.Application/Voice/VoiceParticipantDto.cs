namespace Librecord.Application.Voice;

public class VoiceParticipantDto
{
    public Guid UserId { get; init; }
    public string Username { get; init; } = null!;
    public string DisplayName { get; init; } = null!;
    public string? AvatarUrl { get; init; }
    public bool IsMuted { get; init; }
    public bool IsDeafened { get; init; }
    public bool IsCameraOn { get; init; }
    public bool IsScreenSharing { get; init; }
    public DateTime JoinedAt { get; init; }
}
