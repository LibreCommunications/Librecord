namespace Librecord.Api.TransportDtos.Dm;

public sealed class DmRealtimeMessageDeletedTransport
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
}
