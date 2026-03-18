namespace Librecord.Api.TransportDtos.Dm;

public sealed class DmRealtimeReadStateUpdatedTransport
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
    public Guid UserId { get; init; }
    public DateTime ReadAt { get; init; }
}
