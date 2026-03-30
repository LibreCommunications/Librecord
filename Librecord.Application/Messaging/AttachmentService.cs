using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Storage;
using SixLabors.ImageSharp;

namespace Librecord.Application.Messaging;

public class AttachmentService : IAttachmentService
{
    private readonly IAttachmentRepository _repo;
    private readonly IAttachmentStorageService _storage;

    public AttachmentService(IAttachmentRepository repo, IAttachmentStorageService storage)
    {
        _repo = repo;
        _storage = storage;
    }

    public async Task<List<MessageAttachment>> SaveAttachmentsAsync(
        Guid messageId, IReadOnlyList<AttachmentUpload> files)
    {
        var attachments = new List<MessageAttachment>();

        foreach (var file in files)
        {
            if (file.Size == 0) continue;

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var objectName = $"attachments/{messageId}/{Guid.NewGuid()}{ext}";

            // Extract image dimensions before upload (IdentifyAsync only reads headers)
            int? width = null, height = null;
            if (file.ContentType.StartsWith("image/"))
            {
                try
                {
                    var info = await Image.IdentifyAsync(file.Stream);
                    if (info != null) { width = info.Width; height = info.Height; }
                    file.Stream.Position = 0;
                }
                catch { if (file.Stream.CanSeek) file.Stream.Position = 0; }
            }

            await _storage.UploadAsync(objectName, file.Stream, file.ContentType);

            var attachment = new MessageAttachment
            {
                Id = Guid.NewGuid(),
                MessageId = messageId,
                FileName = file.FileName,
                Url = $"/cdn/private/{objectName}",
                Size = file.Size,
                ContentType = file.ContentType,
                FileExtension = ext,
                Width = width,
                Height = height,
                CreatedAt = DateTime.UtcNow
            };

            await _repo.AddAttachmentAsync(attachment);
            attachments.Add(attachment);
        }

        await _repo.SaveChangesAsync();
        return attachments;
    }
}
