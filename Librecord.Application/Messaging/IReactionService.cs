using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Messaging;

public interface IReactionService
{
    Task<MessageReaction> AddReactionAsync(Guid messageId, Guid userId, string emoji);
    Task RemoveReactionAsync(Guid messageId, Guid userId, string emoji);
}
