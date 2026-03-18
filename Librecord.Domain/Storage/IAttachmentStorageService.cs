namespace Librecord.Domain.Storage;

public interface IAttachmentStorageService
{
    Task<string> UploadAsync(string objectName, Stream data, string contentType);
    Task<Stream> DownloadAsync(string objectName);
    Task<bool> ExistsAsync(string objectName);
    Task DeleteAsync(string objectName);
    Task<string> GetPresignedUrl(string objectName, int expirySeconds = 3600);
}