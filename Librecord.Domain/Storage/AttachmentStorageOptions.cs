namespace Librecord.Domain.Storage;

public class AttachmentStorageOptions
{
    public string Endpoint { get; set; } = "";
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string Bucket { get; set; } = "attachments";
    public bool UseSSL { get; set; } = false;
}