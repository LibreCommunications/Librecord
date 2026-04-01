using Librecord.Domain.Identity;

namespace Librecord.Domain.Social;

public class Friendship
{
    public Guid Id { get; set; }

    public Guid RequesterId { get; set; }
    public User Requester { get; set; } = null!;

    public Guid TargetId { get; set; }
    public User Target { get; set; } = null!;

    public FriendshipStatus Status { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid OtherUserId(Guid myId) => RequesterId == myId ? TargetId : RequesterId;
}