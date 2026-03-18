namespace Librecord.Domain.Messaging.Direct;

public class DmChannel
{
    public Guid Id { get; set; }

    public string? Name { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<DmChannelMember> Members { get; set; } = [];
    public List<DmChannelMessage> Messages { get; set; } = [];
}
