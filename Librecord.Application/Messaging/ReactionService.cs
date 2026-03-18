using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Messaging;

public class ReactionService : IReactionService
{
    private readonly IReactionRepository _reactions;

    public ReactionService(IReactionRepository reactions)
    {
        _reactions = reactions;
    }

    public async Task<MessageReaction> AddReactionAsync(Guid messageId, Guid userId, string emoji)
    {
        if (string.IsNullOrWhiteSpace(emoji))
            throw new ArgumentException("Emoji is required.");

        var existing = await _reactions.GetAsync(messageId, userId, emoji);
        if (existing != null)
            return existing;

        var reaction = new MessageReaction
        {
            MessageId = messageId,
            UserId = userId,
            Emoji = emoji.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        await _reactions.AddAsync(reaction);
        await _reactions.SaveChangesAsync();

        return reaction;
    }

    public async Task RemoveReactionAsync(Guid messageId, Guid userId, string emoji)
    {
        await _reactions.RemoveAsync(messageId, userId, emoji);
        await _reactions.SaveChangesAsync();
    }
}
