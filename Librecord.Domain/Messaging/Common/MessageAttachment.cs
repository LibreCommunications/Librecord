namespace Librecord.Domain.Messaging.Common;

public class MessageAttachment
{
    public Guid Id { get; set; }

    // -------------------------
    // File metadata
    // -------------------------
    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public long Size { get; set; }
    public string ContentType { get; set; } = "";

    // -------------------------
    // Extra metadata
    // -------------------------
    public string? FileExtension { get; set; } // ".png"
    public bool IsSpoiler { get; set; }

    // -------------------------
    // Images / Videos
    // -------------------------
    public int? Width { get; set; }
    public int? Height { get; set; }

    // -------------------------
    // Video / Audio
    // -------------------------
    public double? Duration { get; set; } // seconds
    public string? WaveformJson { get; set; }

    // -------------------------
    // Integrity / CDN
    // -------------------------
    public string? HashSHA256 { get; set; }
    public string? ProxyUrl { get; set; }
    public string? PreviewUrl { get; set; }

    // -------------------------
    // Accessibility / UX
    // -------------------------
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public Guid MessageId { get; set; }
    public Message Message { get; set; } = null!;
}