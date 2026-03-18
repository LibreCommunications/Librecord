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
        var blocked = await _db.UserBlocks
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId)
            .ToHashSetAsync();

        return blocked;
    }
}
