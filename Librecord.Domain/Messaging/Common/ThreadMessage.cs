namespace Librecord.Domain.Messaging.Common;

public class ThreadMessage
{
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;

    public Guid ThreadId { get; set; }
    public MessageThread Thread { get; set; } = null!;
}
