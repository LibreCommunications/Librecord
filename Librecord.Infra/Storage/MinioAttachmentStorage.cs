using System.IO.Pipelines;
using Librecord.Domain.Storage;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;

namespace Librecord.Infra.Services;

public class MinioAttachmentStorage : IAttachmentStorageService
{
    private readonly IMinioClient _client;

    private readonly AttachmentStorageOptions _opts;

    public MinioAttachmentStorage(IOptions<AttachmentStorageOptions> opts)
    {
        _opts = opts.Value;

        _client = new MinioClient()
            .WithEndpoint(_opts.Endpoint)
            .WithCredentials(_opts.AccessKey, _opts.SecretKey)
            .WithSSL(_opts.UseSSL)
            .Build();
    }

    public async Task<string> UploadAsync(string objectName, Stream data, string contentType)
    {
        await _client.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_opts.Bucket)
            .WithObject(objectName)
            .WithStreamData(data)
            .WithContentType(contentType)
            .WithObjectSize(data.Length));

        return objectName;
    }

    public async Task<Stream> DownloadAsync(string objectName)
    {
        var memory = new MemoryStream();

        await _client.GetObjectAsync(
            new GetObjectArgs()
                .WithBucket(_opts.Bucket)
                .WithObject(objectName)
                .WithCallbackStream(stream =>
                {
                    stream.CopyTo(memory);
                })
        );

        memory.Position = 0;
        return memory;
    }


    public async Task<bool> ExistsAsync(string objectName)
    {
        try
        {
            await _client.StatObjectAsync(new StatObjectArgs()
                .WithBucket(_opts.Bucket)
                .WithObject(objectName));

            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task DeleteAsync(string objectName)
    {
        await _client.RemoveObjectAsync(new RemoveObjectArgs()
            .WithBucket(_opts.Bucket)
            .WithObject(objectName));
    }

    public Task<string> GetPresignedUrl(string objectName, int expirySeconds = 3600)
    {
        return _client.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(_opts.Bucket)
            .WithObject(objectName)
            .WithExpiry(expirySeconds));
    }
}