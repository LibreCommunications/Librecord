namespace Librecord.Domain.Messaging.Common;

public interface IAttachmentAccessRepository
{
    Task<bool> CanUserAccessMessageAsync(Guid messageId, Guid userId);
}
