using Librecord.Api.Dtos.Identity;
using Librecord.Api.Dtos.User;
using Librecord.Contracts.Messages;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Api.Dtos.Messages;

public sealed class MessageDto
{
    public Guid Id { get; init; }

    public string? ClientMessageId { get; init; }

    /// <summary>
    /// Plaintext message content.
    /// Messages are encrypted at rest and decrypted before reaching the API layer.
    /// </summary>
    public required string Content { get; init; }

    public DateTime CreatedAt { get; init; }
    public DateTime? EditedAt { get; init; }

    public required UserSummaryDto Author { get; init; }
    public required MessageContextDto Context { get; init; }

    public IReadOnlyList<MessageAttachmentDto> Attachments { get; init; } = [];
    public IReadOnlyList<MessageReactionDto> Reactions { get; init; } = [];
    public IReadOnlyList<MessageEditDto> Edits { get; init; } = [];

    public static MessageDto From(Message message, string? clientMessageId = null)
    {
        return new MessageDto
        {
            Id = message.Id,
            ClientMessageId = clientMessageId,
            Content = message.ContentText ?? "",
            CreatedAt = message.CreatedAt,
            EditedAt = message.EditedAt,

            Author = UserSummaryDto.From(message.User),
            Context = MessageContextDto.From(message),

            Attachments = message.Attachments
                .Select(MessageAttachmentDto.From)
                .ToList(),

            Reactions = message.Reactions
                .Select(MessageReactionDto.From)
                .ToList(),

            Edits = message.Edits
                .Select(MessageEditDto.From)
                .ToList()
        };
    }
}
