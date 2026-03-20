using Librecord.Domain.Identity;
using Librecord.Domain.Social;

namespace Librecord.Application.Users;

public class PresenceService : IPresenceService
{
    private readonly IPresenceRepository _presence;

    public PresenceService(IPresenceRepository presence)
    {
        _presence = presence;
    }

    public async Task SetStatusAsync(Guid userId, UserStatus status)
    {
        var presence = await _presence.GetAsync(userId);

        if (presence == null)
        {
            presence = new UserPresence
            {
                UserId = userId,
                Status = status,
                LastUpdated = DateTime.UtcNow
            };
            await _presence.AddAsync(presence);
        }
        else
        {
            presence.Status = status;
            presence.LastUpdated = DateTime.UtcNow;
            await _presence.UpdateAsync(presence);
        }

        await _presence.SaveChangesAsync();
    }

    public Task<UserPresence?> GetPresenceAsync(Guid userId)
    {
        return _presence.GetAsync(userId);
    }

    public Task<Dictionary<Guid, UserStatus>> GetBulkPresenceAsync(IEnumerable<Guid> userIds)
    {
        return _presence.GetBulkAsync(userIds);
    }
}
