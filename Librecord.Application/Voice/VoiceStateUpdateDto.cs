namespace Librecord.Application.Voice;

public class VoiceStateUpdateDto
{
    public bool? IsMuted { get; init; }
    public bool? IsDeafened { get; init; }
    public bool? IsCameraOn { get; init; }
    public bool? IsScreenSharing { get; init; }
}
