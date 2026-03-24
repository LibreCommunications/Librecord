using Librecord.Domain.Messaging.Common;
using Librecord.Infra.Database;

namespace Librecord.Infra.Repositories;

public class AttachmentRepository : IAttachmentRepository
{
    private readonly LibrecordContext _db;

    public AttachmentRepository(LibrecordContext db) => _db = db;

    public Task AddAttachmentAsync(MessageAttachment attachment)
    {
        _db.MessageAttachments.Add(attachment);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync() => _db.SaveChangesAsync();
}
