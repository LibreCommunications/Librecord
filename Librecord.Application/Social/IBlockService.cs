using Librecord.Domain.Social;

namespace Librecord.Application.Social;

public interface IBlockService
{
    Task BlockUserAsync(Guid blockerId, Guid blockedId);
    Task<bool> UnblockUserAsync(Guid blockerId, Guid blockedId);
    Task<IReadOnlyList<UserBlock>> GetBlockedUsersAsync(Guid userId);
    Task<bool> IsBlockedAsync(Guid blockerId, Guid blockedId);
}
