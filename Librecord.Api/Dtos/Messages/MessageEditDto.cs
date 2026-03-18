using Librecord.Api.Dtos.Identity;
using Librecord.Api.Dtos.User;
using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Api.Dtos.Messages;

public sealed class MessageEditDto
{
    public DateTime EditedAt { get; init; }
    public required UserSummaryDto Editor { get; init; }

    public static MessageEditDto From(MessageEdit edit)
        => new()
        {
            EditedAt = edit.EditedAt,
            Editor = UserSummaryDto.From(edit.Editor)
        };
    
    public static MessageEditDto From(MessageEditSnapshot edit)
        => new()
        {
            EditedAt = edit.EditedAt,
            Editor = new UserSummaryDto
            {
                Id = edit.EditorId,
                Username = edit.EditorUsername,
                DisplayName = edit.EditorDisplayName,
                AvatarUrl = edit.EditorAvatarUrl
            }
        };
    
}