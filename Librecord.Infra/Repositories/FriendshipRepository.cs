using Librecord.Domain.Social;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class FriendshipRepository : IFriendshipRepository
{
    private readonly LibrecordContext _db;

    public FriendshipRepository(LibrecordContext db)
    {
        _db = db;
    }

    public async Task<Friendship?> GetFriendshipAsync(Guid requesterId, Guid targetId)
    {
        return await _db.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Target)
            .FirstOrDefaultAsync(f =>
                (f.RequesterId == requesterId && f.TargetId == targetId) ||
                (f.RequesterId == targetId && f.TargetId == requesterId)
            );
    }

    public async Task<HashSet<Guid>> GetRelatedUserIdsAsync(Guid userId)
    {
        return await _db.Friendships
            .Where(f =>
                f.RequesterId == userId ||
                f.TargetId == userId)
            .Select(f =>
                f.RequesterId == userId
                    ? f.TargetId
                    : f.RequesterId)
            .ToHashSetAsync();
    }


    public async Task<List<Friendship>> GetFriendshipsForUserAsync(Guid userId)
    {
        return await _db.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Target)
            .Where(f =>
                f.Status == FriendshipStatus.Accepted &&
                (f.RequesterId == userId || f.TargetId == userId))
            .ToListAsync();
    }

    public async Task<List<Friendship>> GetIncomingRequestsAsync(Guid userId)
    {
        return await _db.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Target)
            .Where(f => f.TargetId == userId && f.Status == FriendshipStatus.Pending)
            .ToListAsync();
    }

    public async Task<List<Friendship>> GetOutgoingRequestsAsync(Guid userId)
    {
        return await _db.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Target)
            .Where(f => f.RequesterId == userId && f.Status == FriendshipStatus.Pending)
            .ToListAsync();
    }

    public async Task AddAsync(Friendship friendship)
    {
        await _db.Friendships.AddAsync(friendship);
    }

    public Task UpdateAsync(Friendship friendship)
    {
        _db.Friendships.Update(friendship);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Friendship friendship)
    {
        _db.Friendships.Remove(friendship);
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }

    public async Task<bool> UsersAreConfirmedFriendsAsync(Guid userA, Guid userB)
    {
        if (userA == userB)
            return false;

        return await _db.Friendships.AnyAsync(f =>
            f.Status == FriendshipStatus.Accepted &&
            (
                (f.RequesterId == userA && f.TargetId == userB) ||
                (f.RequesterId == userB && f.TargetId == userA)
            )
        );
    }
}