namespace Librecord.Domain.Social;

public interface IBlockRepository
{
    /// <summary>
    /// Returns true if either user has blocked the other (bidirectional check).
    /// </summary>
    Task<bool> IsEitherBlockedAsync(Guid userA, Guid userB);

    /// <summary>
    /// Returns all user IDs that <paramref name="userId"/> has blocked
    /// OR that have blocked <paramref name="userId"/>.
    /// </summary>
    Task<HashSet<Guid>> GetAllBlockedUserIdsAsync(Guid userId);
}
