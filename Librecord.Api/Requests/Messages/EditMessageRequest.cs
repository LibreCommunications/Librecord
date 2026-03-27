using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Requests.Messages;

public sealed class EditMessageRequest
{
    [Required, MaxLength(4000)]
    public string Content { get; init; } = null!;
}
