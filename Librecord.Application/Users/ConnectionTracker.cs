using System.Collections.Concurrent;

namespace Librecord.Application.Users;

public class ConnectionTracker : IConnectionTracker
{
    private readonly ConcurrentDictionary<Guid, int> _connections = new();

    public void Connect(Guid userId)
    {
        _connections.AddOrUpdate(userId, 1, (_, count) => count + 1);
    }

    public void Disconnect(Guid userId)
    {
        _connections.AddOrUpdate(userId, 0, (_, count) => Math.Max(0, count - 1));
        if (_connections.TryGetValue(userId, out var c) && c <= 0)
            _connections.TryRemove(userId, out _);
    }

    public bool IsOnline(Guid userId)
    {
        return _connections.TryGetValue(userId, out var count) && count > 0;
    }

    public HashSet<Guid> GetOnlineUsers(IEnumerable<Guid> userIds)
    {
        var result = new HashSet<Guid>();
        foreach (var id in userIds)
        {
            if (IsOnline(id))
                result.Add(id);
        }
        return result;
    }
}
