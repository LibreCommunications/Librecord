using Librecord.Application.Messaging;

namespace Librecord.Api.TransportDtos.Guild;

public sealed class GuildRealtimeMessageCreatedTransport
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }

    public string Content { get; init; } = null!;
    public DateTime CreatedAt { get; init; }

    public GuildAuthorSnapshot Author { get; init; } = null!;

    public string? ClientMessageId { get; init; }

    public IReadOnlyList<MessageAttachmentSnapshot> Attachments { get; init; } = [];
}
