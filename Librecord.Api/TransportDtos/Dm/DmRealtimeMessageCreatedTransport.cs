using Librecord.Api.Dtos.Messages;
using Librecord.Application.Messaging;

namespace Librecord.Api.TransportDtos.Dm;

public sealed class DmRealtimeMessageCreatedTransport
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }

    public string Content { get; init; } = null!;
    public DateTime CreatedAt { get; init; }

    public DmAuthorSnapshot Author { get; init; } = null!;

    public IReadOnlyList<MessageAttachmentDto> Attachments { get; init; } = [];
    public IReadOnlyList<MessageReactionDto> Reactions { get; init; } = [];
    public IReadOnlyList<MessageEditDto> Edits { get; init; } = [];

    public string? ClientMessageId { get; init; }
}
