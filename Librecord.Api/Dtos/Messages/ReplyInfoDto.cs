using Librecord.Api.Dtos.Identity;

namespace Librecord.Api.Dtos.Messages;

public sealed class ReplyInfoDto
{
    public Guid MessageId { get; init; }
    public string Content { get; init; } = "";
    public UserSummaryDto? Author { get; init; }
}
