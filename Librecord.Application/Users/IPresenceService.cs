using Librecord.Domain.Identity;
using Librecord.Domain.Social;

namespace Librecord.Application.Users;

public interface IPresenceService
{
    Task SetOnlineAsync(Guid userId);
    Task SetOfflineAsync(Guid userId);
    Task SetStatusAsync(Guid userId, UserStatus status);
    Task<UserPresence?> GetPresenceAsync(Guid userId);
    Task<Dictionary<Guid, UserStatus>> GetBulkPresenceAsync(IEnumerable<Guid> userIds);
}
