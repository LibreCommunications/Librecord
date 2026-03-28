using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Realtime.Guild;

public abstract class GuildMessageEvent
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
}

public sealed class GuildMessageCreated : GuildMessageEvent
{
    public string? ClientMessageId { get; init; }

    public Guid AuthorId { get; init; }

    public string Content { get; init; } = null!;
    public DateTime CreatedAt { get; init; }

    public GuildAuthorSnapshot Author { get; init; } = null!;

    public ReplySnapshot? ReplyTo { get; init; }

    public IReadOnlyList<MessageAttachmentSnapshot> Attachments { get; init; } = [];
}

public sealed class GuildMessageEdited : GuildMessageEvent
{
    public string Content { get; init; } = null!;
    public DateTime? EditedAt { get; init; }
}

public sealed class GuildMessageDeleted : GuildMessageEvent
{
}

public sealed class GuildMemberRemoved
{
    public Guid GuildId { get; init; }
    public Guid UserId { get; init; }
    public IReadOnlyList<Guid> ChannelIds { get; init; } = [];
}

public sealed class GuildUpdated
{
    public Guid GuildId { get; init; }
    public string? Name { get; init; }
    public string? IconUrl { get; init; }
    public IReadOnlyList<Guid> ChannelIds { get; init; } = [];
}

// Uses ChannelId to target broadcast groups
public sealed class GuildDeleted
{
    public Guid GuildId { get; init; }
    public IReadOnlyList<Guid> ChannelIds { get; init; } = [];
}
