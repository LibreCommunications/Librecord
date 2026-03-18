namespace Librecord.Domain.Social;

public interface IFriendshipRepository
{
    Task<Friendship?> GetFriendshipAsync(Guid requesterId, Guid targetId);
    Task<List<Friendship>> GetFriendshipsForUserAsync(Guid userId);
    Task<List<Friendship>> GetIncomingRequestsAsync(Guid userId);
    Task<List<Friendship>> GetOutgoingRequestsAsync(Guid userId);

    Task<HashSet<Guid>> GetRelatedUserIdsAsync(Guid userId);

    Task AddAsync(Friendship friendship);
    Task UpdateAsync(Friendship friendship);
    Task DeleteAsync(Friendship friendship);

    Task SaveChangesAsync();
    Task<bool> UsersAreConfirmedFriendsAsync(Guid userA, Guid userB);
}