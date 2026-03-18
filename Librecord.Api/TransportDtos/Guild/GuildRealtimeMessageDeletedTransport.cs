namespace Librecord.Api.TransportDtos.Guild;

public sealed class GuildRealtimeMessageDeletedTransport
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
}
