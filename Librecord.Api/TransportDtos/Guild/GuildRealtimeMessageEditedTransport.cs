namespace Librecord.Api.TransportDtos.Guild;

public sealed class GuildRealtimeMessageEditedTransport
{
    public Guid ChannelId { get; init; }
    public Guid MessageId { get; init; }
    public string Content { get; init; } = null!;
    public DateTime? EditedAt { get; init; }
}
