namespace Librecord.Api.Requests.Messages;

public sealed class SendMessageRequest
{
    public string Content { get; init; } = null!;
    public string ClientMessageId { get; init; } = null!;
}