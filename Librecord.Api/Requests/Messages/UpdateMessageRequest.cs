using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Requests;

public class UpdateMessageRequest
{
    [Required, MaxLength(4000)]
    public string Content { get; set; } = "";
}
