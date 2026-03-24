namespace Librecord.Application.Messaging;

public interface IPinService
{
    Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId);
    Task<bool> PinMessageAsync(Guid channelId, Guid messageId, Guid userId);
    Task<bool> UnpinMessageAsync(Guid channelId, Guid messageId);
    Task<IReadOnlyList<PinnedMessageResult>> GetPinnedMessagesAsync(Guid channelId);
}

public record PinnedMessageResult(
    Guid MessageId, Guid ChannelId, string? Content, DateTime CreatedAt,
    PinnedMessageAuthor Author, PinnedMessageAuthor PinnedBy, DateTime PinnedAt);

public record PinnedMessageAuthor(Guid Id, string? Username, string DisplayName);
