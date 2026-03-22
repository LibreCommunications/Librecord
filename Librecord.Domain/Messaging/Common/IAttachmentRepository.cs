namespace Librecord.Domain.Messaging.Common;

public interface IAttachmentRepository
{
    Task AddAttachmentAsync(MessageAttachment attachment);
    Task SaveChangesAsync();
}
