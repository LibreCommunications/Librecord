using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;

namespace Librecord.Api.Dtos.Messages;

public sealed class MessageAttachmentDto
{
    public Guid Id { get; init; }
    public string FileName { get; init; } = "";
    public string Url { get; init; } = "";
    public long Size { get; init; }
    public string ContentType { get; init; } = "";

    public bool IsSpoiler { get; init; }
    public int? Width { get; init; }
    public int? Height { get; init; }
    public double? Duration { get; init; }

    public static MessageAttachmentDto From(MessageAttachment a)
        => new()
        {
            Id = a.Id,
            FileName = a.FileName,
            Url = a.Url,
            Size = a.Size,
            ContentType = a.ContentType,
            IsSpoiler = a.IsSpoiler,
            Width = a.Width,
            Height = a.Height,
            Duration = a.Duration
        };

    public static MessageAttachmentDto From(MessageAttachmentSnapshot a)
        => new()
        {
            Id = a.Id,
            FileName = a.FileName,
            Url = a.Url,
            Size = a.Size,
            ContentType = a.ContentType,
            IsSpoiler = a.IsSpoiler,
            Width = a.Width,
            Height = a.Height,
            Duration = a.Duration
        };
}