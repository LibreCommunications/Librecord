using Librecord.Domain;
using Librecord.Domain.Social;

namespace Librecord.Application.Social;

public class BlockService : IBlockService
{
    private readonly IBlockRepository _blocks;
    private readonly IFriendshipRepository _friendships;
    private readonly IUnitOfWork _uow;

    public BlockService(IBlockRepository blocks, IFriendshipRepository friendships, IUnitOfWork uow)
    {
        _blocks = blocks;
        _friendships = friendships;
        _uow = uow;
    }

    public async Task BlockUserAsync(Guid blockerId, Guid blockedId)
    {
        if (blockerId == blockedId)
            throw new InvalidOperationException("Cannot block yourself.");

        var existing = await _blocks.GetBlockAsync(blockerId, blockedId);
        if (existing != null) return;

        await _uow.ExecuteInTransactionAsync(async () =>
        {
            await _blocks.AddBlockAsync(new UserBlock
            {
                BlockerId = blockerId,
                BlockedId = blockedId,
                CreatedAt = DateTime.UtcNow
            });

            var friendships = await _friendships.GetFriendshipsForUserAsync(blockerId);
            foreach (var fs in friendships.Where(f => f.RequesterId == blockedId || f.TargetId == blockedId))
            {
                await _friendships.DeleteAsync(fs);
            }
        });
    }

    public async Task<bool> UnblockUserAsync(Guid blockerId, Guid blockedId)
    {
        var block = await _blocks.GetBlockAsync(blockerId, blockedId);
        if (block == null) return false;

        await _blocks.RemoveBlockAsync(block);
        await _blocks.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<UserBlock>> GetBlockedUsersAsync(Guid userId)
    {
        return await _blocks.GetBlocksForUserAsync(userId);
    }

    public Task<bool> IsBlockedAsync(Guid blockerId, Guid blockedId)
    {
        return _blocks.IsBlockedAsync(blockerId, blockedId);
    }
}
