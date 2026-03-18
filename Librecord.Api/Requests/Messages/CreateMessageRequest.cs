namespace Librecord.Api.Requests.Messages;

public sealed class CreateMessageRequest
{
    public string ClientMessageId { get; set; } = null!;
    public string Content { get; set; } = "";
}