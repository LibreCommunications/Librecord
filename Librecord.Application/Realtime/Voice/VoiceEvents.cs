namespace Librecord.Application.Realtime.Voice;

// ---------------------------------------------------------
// BASE EVENT
// ---------------------------------------------------------
public abstract class VoiceEvent
{
    public Guid ChannelId { get; init; }
    public Guid GuildId { get; init; }
    public Guid UserId { get; init; }
}

// ---------------------------------------------------------
// USER JOINED
// ---------------------------------------------------------
public sealed class VoiceUserJoined : VoiceEvent
{
    public string Username { get; init; } = null!;
    public string DisplayName { get; init; } = null!;
    public string? AvatarUrl { get; init; }
}

// ---------------------------------------------------------
// USER LEFT
// ---------------------------------------------------------
public sealed class VoiceUserLeft : VoiceEvent
{
}

// ---------------------------------------------------------
// USER STATE CHANGED
// ---------------------------------------------------------
public sealed class VoiceUserStateChanged : VoiceEvent
{
    public bool IsMuted { get; init; }
    public bool IsDeafened { get; init; }
    public bool IsCameraOn { get; init; }
    public bool IsScreenSharing { get; init; }
}
