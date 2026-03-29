using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Requests;

public class UpdateChannelRequest
{
    [MaxLength(64)]
    public string? Name { get; set; }

    [MaxLength(1024)]
    public string? Topic { get; set; }

    public Guid? ParentId { get; set; }
}
