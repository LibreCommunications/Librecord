namespace Librecord.Application.Users;

public interface IConnectionTracker
{
    void Connect(Guid userId);
    void Disconnect(Guid userId);
    bool IsOnline(Guid userId);
    HashSet<Guid> GetOnlineUsers(IEnumerable<Guid> userIds);
}
