using Librecord.Domain.Identity;
using Librecord.Domain.Social;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class PresenceRepository : IPresenceRepository
{
    private readonly LibrecordContext _db;

    public PresenceRepository(LibrecordContext db)
    {
        _db = db;
    }

    public Task<UserPresence?> GetAsync(Guid userId)
    {
        return _db.UserPresences.FirstOrDefaultAsync(p => p.UserId == userId);
    }

    public async Task<Dictionary<Guid, UserStatus>> GetBulkAsync(IEnumerable<Guid> userIds)
    {
        var ids = userIds.ToList();
        var presences = await _db.UserPresences
            .Where(p => ids.Contains(p.UserId))
            .ToListAsync();

        return presences.ToDictionary(p => p.UserId, p => p.Status);
    }

    public Task AddAsync(UserPresence presence)
    {
        _db.UserPresences.Add(presence);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(UserPresence presence)
    {
        _db.UserPresences.Update(presence);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}
