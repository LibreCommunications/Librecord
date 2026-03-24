namespace Librecord.Application;

public static class Limits
{
    public const int MaxMessageLength = 4000;
    public const long MaxAttachmentSize = 25 * 1024 * 1024; // 25 MB
    public const long MaxAvatarSize = 5 * 1024 * 1024;      // 5 MB
}
