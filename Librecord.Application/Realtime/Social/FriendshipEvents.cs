namespace Librecord.Application.Realtime.Social;

// ---------------------------------------------------------
// BASE EVENT
// ---------------------------------------------------------
public abstract class FriendshipEvent
{
    public Guid UserId { get; init; }
}

// ---------------------------------------------------------
// FRIEND REQUEST RECEIVED (sent to the target user)
// ---------------------------------------------------------
public sealed class FriendRequestReceived : FriendshipEvent
{
    public Guid FromUserId { get; init; }
    public string FromUsername { get; init; } = null!;
    public string FromDisplayName { get; init; } = null!;
    public string? FromAvatarUrl { get; init; }
}

// ---------------------------------------------------------
// FRIEND REQUEST ACCEPTED (sent to the original requester)
// ---------------------------------------------------------
public sealed class FriendRequestAccepted : FriendshipEvent
{
    public Guid FriendUserId { get; init; }
    public string FriendUsername { get; init; } = null!;
    public string FriendDisplayName { get; init; } = null!;
    public string? FriendAvatarUrl { get; init; }
}

// ---------------------------------------------------------
// FRIEND REQUEST DECLINED (sent to the original requester)
// ---------------------------------------------------------
public sealed class FriendRequestDeclined : FriendshipEvent
{
    public Guid DeclinedByUserId { get; init; }
}

// ---------------------------------------------------------
// FRIEND REMOVED (sent to the removed friend)
// ---------------------------------------------------------
public sealed class FriendRemoved : FriendshipEvent
{
    public Guid RemovedByUserId { get; init; }
}
