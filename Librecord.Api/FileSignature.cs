namespace Librecord.Api;

public static class FileSignature
{
    private static readonly (byte[] Magic, string ContentType)[] Signatures =
    [
        ([0xFF, 0xD8, 0xFF], "image/jpeg"),
        ([0x89, 0x50, 0x4E, 0x47], "image/png"),
        ([0x47, 0x49, 0x46, 0x38], "image/gif"),
        ([0x52, 0x49, 0x46, 0x46], "image/webp"), // RIFF....WEBP
        ([0x25, 0x50, 0x44, 0x46], "application/pdf"),
        ([0x00, 0x00, 0x00], "video/mp4"), // ftyp box (offset varies)
        ([0x1A, 0x45, 0xDF, 0xA3], "video/webm"),
        ([0x49, 0x44, 0x33], "audio/mpeg"), // ID3 tag
        ([0xFF, 0xFB], "audio/mpeg"), // MP3 sync word
        ([0xFF, 0xF3], "audio/mpeg"),
        ([0xFF, 0xF2], "audio/mpeg"),
        ([0x4F, 0x67, 0x67, 0x53], "audio/ogg"),
        ([0x52, 0x49, 0x46, 0x46], "audio/wav"), // RIFF....WAVE
    ];

    /// <summary>
    /// Detects content type from file magic bytes. Falls back to the provided
    /// fallback (typically the client-provided content type) if unrecognized.
    /// </summary>
    public static string Detect(Stream stream, string fallback)
    {
        if (!stream.CanSeek)
            return fallback;

        Span<byte> header = stackalloc byte[12];
        var originalPosition = stream.Position;
        var bytesRead = stream.Read(header);
        stream.Position = originalPosition;

        if (bytesRead < 4)
            return fallback;

        foreach (var (magic, contentType) in Signatures)
        {
            if (bytesRead >= magic.Length && header[..magic.Length].SequenceEqual(magic))
            {
                // Disambiguate RIFF: could be WEBP or WAV
                if (magic is [0x52, 0x49, 0x46, 0x46] && bytesRead >= 12)
                {
                    if (header[8..12].SequenceEqual("WEBP"u8))
                        return "image/webp";
                    if (header[8..12].SequenceEqual("WAVE"u8))
                        return "audio/wav";
                    continue;
                }

                // MP4: check for ftyp at offset 4
                if (magic is [0x00, 0x00, 0x00] && bytesRead >= 8)
                {
                    if (header[4..8].SequenceEqual("ftyp"u8))
                        return "video/mp4";
                    continue;
                }

                return contentType;
            }
        }

        return fallback;
    }
}
