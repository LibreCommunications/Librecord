namespace Librecord.Application.Messaging;

public sealed class MessageAttachmentSnapshot
{
    public Guid Id { get; init; }

    public string FileName { get; init; } = null!;
    public string ContentType { get; init; } = null!;
    public long Size { get; init; }

    public string Url { get; init; } = null!;

    public bool IsSpoiler { get; init; }

    public int? Width { get; init; }
    public int? Height { get; init; }

    public double? Duration { get; init; }
}