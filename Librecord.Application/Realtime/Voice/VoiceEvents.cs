namespace Librecord.Application.Realtime.Voice;

public abstract class VoiceEvent
{
    public Guid ChannelId { get; init; }
    public Guid GuildId { get; init; }
    public Guid UserId { get; init; }
}

public sealed class VoiceUserJoined : VoiceEvent
{
    public string Username { get; init; } = null!;
    public string DisplayName { get; init; } = null!;
    public string? AvatarUrl { get; init; }
    public bool IsMuted { get; init; }
    public bool IsDeafened { get; init; }
    public bool IsCameraOn { get; init; }
    public bool IsScreenSharing { get; init; }
}

public sealed class VoiceUserLeft : VoiceEvent
{
}

public sealed class VoiceUserStateChanged : VoiceEvent
{
    public bool IsMuted { get; init; }
    public bool IsDeafened { get; init; }
    public bool IsCameraOn { get; init; }
    public bool IsScreenSharing { get; init; }
}

/// <summary>
/// Sent to a user when their voice session is replaced by a join from another device.
/// </summary>
public sealed class VoiceSessionReplaced : VoiceEvent
{
}
