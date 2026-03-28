using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Realtime.DMs;

public abstract class DmMessageEvent
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
}

public sealed class DmMessageCreated : DmMessageEvent
{
    public string? ClientMessageId { get; init; }

    public Guid AuthorId { get; init; }

    public string Content { get; init; } = null!;
    public DateTime CreatedAt { get; init; }

    public DmAuthorSnapshot Author { get; init; } = null!;

    public ReplySnapshot? ReplyTo { get; init; }

    public IReadOnlyList<MessageAttachmentSnapshot> Attachments { get; init; } = [];
    public IReadOnlyList<MessageReactionSnapshot> Reactions { get; init; } = [];
    public IReadOnlyList<MessageEditSnapshot> Edits { get; init; } = [];
}

public sealed class DmMessageEdited : DmMessageEvent
{
    public string Content { get; init; } = null!;

    public DateTime? EditedAt { get; init; }
}

public sealed class DmMessageDeleted : DmMessageEvent
{
}

public sealed class DmReadStateUpdated : DmMessageEvent
{
    public Guid UserId { get; init; }
    public DateTime ReadAt { get; init; }
}
