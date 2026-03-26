namespace Librecord.Application.Realtime.Social;

public abstract class FriendshipEvent
{
    public Guid UserId { get; init; }
}

public sealed class FriendRequestReceived : FriendshipEvent
{
    public Guid FromUserId { get; init; }
    public string FromUsername { get; init; } = null!;
    public string FromDisplayName { get; init; } = null!;
    public string? FromAvatarUrl { get; init; }
}

public sealed class FriendRequestAccepted : FriendshipEvent
{
    public Guid FriendUserId { get; init; }
    public string FriendUsername { get; init; } = null!;
    public string FriendDisplayName { get; init; } = null!;
    public string? FriendAvatarUrl { get; init; }
}

public sealed class FriendRequestDeclined : FriendshipEvent
{
    public Guid DeclinedByUserId { get; init; }
}

public sealed class FriendRemoved : FriendshipEvent
{
    public Guid RemovedByUserId { get; init; }
}
