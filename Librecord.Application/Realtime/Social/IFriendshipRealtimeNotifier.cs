namespace Librecord.Application.Realtime.Social;

public interface IFriendshipRealtimeNotifier
{
    Task NotifyAsync(FriendshipEvent evt);
}
