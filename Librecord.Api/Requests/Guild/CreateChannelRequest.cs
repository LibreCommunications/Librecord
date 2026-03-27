using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Requests;

public class CreateChannelRequest
{
    [Required, MinLength(1), MaxLength(64)]
    public string Name { get; set; } = "";

    public int Type { get; set; }
    public int Position { get; set; }

    [MaxLength(1024)]
    public string? Topic { get; set; }
}
