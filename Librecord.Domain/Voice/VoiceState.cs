namespace Librecord.Domain.Voice;

public class VoiceState
{
    public Guid UserId { get; set; }
    public Guid ChannelId { get; set; }
    public Guid GuildId { get; set; }

    public bool IsMuted { get; set; }
    public bool IsDeafened { get; set; }
    public bool IsCameraOn { get; set; }
    public bool IsScreenSharing { get; set; }

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
