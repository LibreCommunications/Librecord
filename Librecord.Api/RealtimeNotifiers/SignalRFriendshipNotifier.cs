using Librecord.Api.Hubs;
using Librecord.Application.Realtime.Social;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.RealtimeNotifiers;

public sealed class SignalRFriendshipNotifier : IFriendshipRealtimeNotifier
{
    private readonly IHubContext<DmHub> _hub;

    public SignalRFriendshipNotifier(IHubContext<DmHub> hub)
    {
        _hub = hub;
    }

    public Task NotifyAsync(FriendshipEvent evt)
    {
        // Friendship events target a specific user, not a channel group.
        var target = _hub.Clients.User(evt.UserId.ToString());

        return evt switch
        {
            FriendRequestReceived received =>
                target.SendAsync(
                    "friend:request:received",
                    new
                    {
                        fromUserId = received.FromUserId,
                        fromUsername = received.FromUsername,
                        fromDisplayName = received.FromDisplayName,
                        fromAvatarUrl = received.FromAvatarUrl
                    }),

            FriendRequestAccepted accepted =>
                target.SendAsync(
                    "friend:request:accepted",
                    new
                    {
                        friendUserId = accepted.FriendUserId,
                        friendUsername = accepted.FriendUsername,
                        friendDisplayName = accepted.FriendDisplayName,
                        friendAvatarUrl = accepted.FriendAvatarUrl
                    }),

            FriendRequestDeclined declined =>
                target.SendAsync(
                    "friend:request:declined",
                    new
                    {
                        declinedByUserId = declined.DeclinedByUserId
                    }),

            FriendRemoved removed =>
                target.SendAsync(
                    "friend:removed",
                    new
                    {
                        removedByUserId = removed.RemovedByUserId
                    }),

            _ => Task.CompletedTask
        };
    }
}
