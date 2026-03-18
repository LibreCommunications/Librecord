using Librecord.Application.Messaging;

namespace Librecord.Api.TransportDtos.Dm;

public sealed class DmRealtimeMessageEditedTransport
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
    public string Content { get; init; } = null!;
    public DateTime CreatedAt { get; init; }
    public DateTime EditedAt { get; init; }
    public DmAuthorSnapshot Author { get; init; } = null!;
    public string? ClientMessageId { get; init; }
}
