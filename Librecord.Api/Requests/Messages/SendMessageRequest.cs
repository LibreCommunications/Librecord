using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Requests.Messages;

public sealed class SendMessageRequest
{
    [Required, MaxLength(4000)]
    public string Content { get; init; } = null!;

    [Required, MaxLength(64)]
    public string ClientMessageId { get; init; } = null!;
}
