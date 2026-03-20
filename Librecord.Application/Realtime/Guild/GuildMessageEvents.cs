using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Realtime.Guild;

// ---------------------------------------------------------
// BASE EVENT
// ---------------------------------------------------------
public abstract class GuildMessageEvent
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
}

// ---------------------------------------------------------
// MESSAGE CREATED
// ---------------------------------------------------------
public sealed class GuildMessageCreated : GuildMessageEvent
{
    public string? ClientMessageId { get; init; }

    public Guid AuthorId { get; init; }

    public string Content { get; init; } = null!;
    public DateTime CreatedAt { get; init; }

    public GuildAuthorSnapshot Author { get; init; } = null!;

    public IReadOnlyList<MessageAttachmentSnapshot> Attachments { get; init; } = [];
}

// ---------------------------------------------------------
// MESSAGE EDITED
// ---------------------------------------------------------
public sealed class GuildMessageEdited : GuildMessageEvent
{
    public string Content { get; init; } = null!;
    public DateTime? EditedAt { get; init; }
}

// ---------------------------------------------------------
// MESSAGE DELETED
// ---------------------------------------------------------
public sealed class GuildMessageDeleted : GuildMessageEvent
{
}
