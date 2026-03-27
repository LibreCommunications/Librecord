using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Requests.Messages;

public sealed class CreateMessageRequest
{
    [Required, MaxLength(64)]
    public string ClientMessageId { get; set; } = null!;

    [MaxLength(4000)]
    public string Content { get; set; } = "";
}
