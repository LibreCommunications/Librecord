using Librecord.Domain.Social;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class BlockRepository : IBlockRepository
{
    private readonly LibrecordContext _db;

    public BlockRepository(LibrecordContext db)
    {
        _db = db;
    }

    public async Task<bool> IsEitherBlockedAsync(Guid userA, Guid userB)
    {
        return await _db.UserBlocks.AnyAsync(b =>
            (b.BlockerId == userA && b.BlockedId == userB) ||
            (b.BlockerId == userB && b.BlockedId == userA));
    }

    public async Task<HashSet<Guid>> GetAllBlockedUserIdsAsync(Guid userId)
    {
        return await _db.UserBlocks
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId)
            .ToHashSetAsync();
    }

    public Task<UserBlock?> GetBlockAsync(Guid blockerId, Guid blockedId)
        => _db.UserBlocks.FirstOrDefaultAsync(b => b.BlockerId == blockerId && b.BlockedId == blockedId);

    public Task<List<UserBlock>> GetBlocksForUserAsync(Guid blockerId)
        => _db.UserBlocks
            .Where(b => b.BlockerId == blockerId)
            .Include(b => b.Blocked)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

    public Task<bool> IsBlockedAsync(Guid blockerId, Guid blockedId)
        => _db.UserBlocks.AnyAsync(b => b.BlockerId == blockerId && b.BlockedId == blockedId);

    public Task AddBlockAsync(UserBlock block)
    {
        _db.UserBlocks.Add(block);
        return Task.CompletedTask;
    }

    public Task RemoveBlockAsync(UserBlock block)
    {
        _db.UserBlocks.Remove(block);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync() => _db.SaveChangesAsync();
}
