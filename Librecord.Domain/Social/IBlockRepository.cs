namespace Librecord.Domain.Social;

public interface IBlockRepository
{
    Task<bool> IsEitherBlockedAsync(Guid userA, Guid userB);
    Task<HashSet<Guid>> GetAllBlockedUserIdsAsync(Guid userId);

    Task<UserBlock?> GetBlockAsync(Guid blockerId, Guid blockedId);
    Task<List<UserBlock>> GetBlocksForUserAsync(Guid blockerId);
    Task<bool> IsBlockedAsync(Guid blockerId, Guid blockedId);
    Task AddBlockAsync(UserBlock block);
    Task RemoveBlockAsync(UserBlock block);
    Task SaveChangesAsync();
}
