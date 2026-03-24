namespace Librecord.Domain.Messaging.Common;

public interface IReactionRepository
{
    Task<MessageReaction?> GetAsync(Guid messageId, Guid userId, string emoji);
    Task<List<MessageReaction>> GetByMessageAsync(Guid messageId);
    Task AddAsync(MessageReaction reaction);
    Task RemoveAsync(Guid messageId, Guid userId, string emoji);
    Task SaveChangesAsync();
    Task<Guid?> GetMessageChannelIdAsync(Guid messageId);
}
