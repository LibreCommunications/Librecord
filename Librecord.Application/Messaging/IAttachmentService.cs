using Librecord.Domain.Messaging.Common;

namespace Librecord.Application.Messaging;

public interface IAttachmentService
{
    Task<List<MessageAttachment>> SaveAttachmentsAsync(Guid messageId, IReadOnlyList<AttachmentUpload> files);
}

public record AttachmentUpload(Stream Stream, string FileName, string ContentType, long Size);
