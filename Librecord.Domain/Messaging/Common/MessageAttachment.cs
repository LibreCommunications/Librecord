namespace Librecord.Domain.Messaging.Common;

public class MessageAttachment
{
    public Guid Id { get; set; }

    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public long Size { get; set; }
    public string ContentType { get; set; } = "";

    public string? FileExtension { get; set; }
    public bool IsSpoiler { get; set; }

    public int? Width { get; set; }
    public int? Height { get; set; }

    public double? Duration { get; set; }
    public string? WaveformJson { get; set; }

    public string? HashSHA256 { get; set; }
    public string? ProxyUrl { get; set; }
    public string? PreviewUrl { get; set; }

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;
}
