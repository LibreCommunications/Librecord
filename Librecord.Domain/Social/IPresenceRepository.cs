using Librecord.Domain.Identity;

namespace Librecord.Domain.Social;

public interface IPresenceRepository
{
    Task<UserPresence?> GetAsync(Guid userId);
    Task<Dictionary<Guid, UserStatus>> GetBulkAsync(IEnumerable<Guid> userIds);
    Task AddAsync(UserPresence presence);
    Task UpdateAsync(UserPresence presence);
    Task SaveChangesAsync();
}
