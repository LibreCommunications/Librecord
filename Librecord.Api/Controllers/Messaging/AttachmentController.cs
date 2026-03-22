using System.Security.Claims;
using Librecord.Api.Dtos.Messages;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Application.Realtime.DMs;
using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Permissions;
using Librecord.Domain.Storage;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("guild-channels/{channelId:guid}/messages")]
public class GuildMessageWithAttachmentController : AuthenticatedController
{
    private readonly IGuildChannelMessageService _messages;
    private readonly IPermissionService _permissions;
    private readonly IAttachmentStorageService _storage;
    private readonly IGuildRealtimeNotifier _realtime;
    private readonly LibrecordContext _db;

    public GuildMessageWithAttachmentController(
        IGuildChannelMessageService messages,
        IPermissionService permissions,
        IAttachmentStorageService storage,
        IGuildRealtimeNotifier realtime,
        LibrecordContext db)
    {
        _messages = messages;
        _permissions = permissions;
        _storage = storage;
        _realtime = realtime;
        _db = db;
    }
    // ---------------------------------------------------------
    // SEND MESSAGE WITH ATTACHMENTS
    // ---------------------------------------------------------
    [HttpPost("with-attachments")]
    [RequestSizeLimit(Librecord.Application.Limits.MaxAttachmentSize)] // 25MB
    public async Task<IActionResult> CreateWithAttachments(
        Guid channelId,
        [FromForm] string? content,
        [FromForm] string? clientMessageId,
        [FromForm] List<IFormFile>? files)
    {
        if (string.IsNullOrWhiteSpace(content) && (files == null || files.Count == 0))
            return BadRequest("Message content or attachments required.");

        var access = await _permissions.HasChannelPermissionAsync(
            UserId, channelId, ChannelPermission.SendMessages);
        if (!access.Allowed) return Forbid();

        // Create message — skip SignalR so we can notify after attachments are saved
        var message = await _messages.CreateMessageAsync(
            channelId,
            UserId,
            content?.Trim() ?? "",
            clientMessageId,
            hasAttachments: files is { Count: > 0 },
            skipNotification: true);

        // Upload and attach files
        if (files != null)
        {
            foreach (var file in files)
            {
                if (file.Length == 0) continue;

                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                var objectName = $"attachments/{message.Id}/{Guid.NewGuid()}{ext}";

                await using var stream = file.OpenReadStream();
                await _storage.UploadAsync(objectName, stream, file.ContentType);

                var attachment = new MessageAttachment
                {
                    Id = Guid.NewGuid(),
                    MessageId = message.Id,
                    FileName = file.FileName,
                    Url = $"/cdn/private/{objectName}",
                    Size = file.Length,
                    ContentType = file.ContentType,
                    FileExtension = ext,
                    CreatedAt = DateTime.UtcNow
                };

                _db.MessageAttachments.Add(attachment);
            }

            await _db.SaveChangesAsync();
        }

        // Re-fetch to include attachments
        message = (await _messages.GetMessageAsync(message.Id))!;

        // Notify after attachments are persisted
        await _realtime.NotifyAsync(new GuildMessageCreated
        {
            ClientMessageId = clientMessageId,
            ChannelId = channelId,
            MessageId = message.Id,
            AuthorId = message.UserId,
            Content = message.ContentText ?? "",
            CreatedAt = message.CreatedAt,
            Author = new GuildAuthorSnapshot
            {
                Id = message.User.Id,
                Username = message.User.UserName!,
                DisplayName = message.User.DisplayName,
                AvatarUrl = message.User.AvatarUrl
            },
            Attachments = message.Attachments.Select(a => new MessageAttachmentSnapshot
            {
                Id = a.Id,
                FileName = a.FileName,
                ContentType = a.ContentType,
                Size = a.Size,
                Url = a.Url
            }).ToList()
        });

        return Ok(MessageDto.From(message, clientMessageId));
    }
}

// DM version
[ApiController]
[Authorize]
[Route("dm-messages/channel/{channelId:guid}")]
public class DmMessageWithAttachmentController : AuthenticatedController
{
    private readonly IDirectMessageService _dms;
    private readonly IAttachmentStorageService _storage;
    private readonly IDmRealtimeNotifier _realtime;
    private readonly LibrecordContext _db;

    public DmMessageWithAttachmentController(
        IDirectMessageService dms,
        IAttachmentStorageService storage,
        IDmRealtimeNotifier realtime,
        LibrecordContext db)
    {
        _dms = dms;
        _storage = storage;
        _realtime = realtime;
        _db = db;
    }
    [HttpPost("with-attachments")]
    [RequestSizeLimit(Librecord.Application.Limits.MaxAttachmentSize)]
    public async Task<IActionResult> CreateWithAttachments(
        Guid channelId,
        [FromForm] string? content,
        [FromForm] string? clientMessageId,
        [FromForm] List<IFormFile>? files)
    {
        if (string.IsNullOrWhiteSpace(content) && (files == null || files.Count == 0))
            return BadRequest("Message content or attachments required.");

        // Create message — skip SignalR so we can notify after attachments are saved
        var message = await _dms.SendMessageAsync(
            channelId,
            UserId,
            content?.Trim() ?? "",
            clientMessageId,
            hasAttachments: files is { Count: > 0 },
            skipNotification: true);

        if (files != null)
        {
            foreach (var file in files)
            {
                if (file.Length == 0) continue;

                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                var objectName = $"attachments/{message.Id}/{Guid.NewGuid()}{ext}";

                await using var stream = file.OpenReadStream();
                await _storage.UploadAsync(objectName, stream, file.ContentType);

                _db.MessageAttachments.Add(new MessageAttachment
                {
                    Id = Guid.NewGuid(),
                    MessageId = message.Id,
                    FileName = file.FileName,
                    Url = $"/cdn/private/{objectName}",
                    Size = file.Length,
                    ContentType = file.ContentType,
                    FileExtension = ext,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();
        }

        // Re-fetch to include attachments
        var hydrated = (await _dms.GetMessageAsync(message.Id))!;

        // Notify after attachments are persisted
        await _realtime.NotifyAsync(new DmMessageCreated
        {
            ClientMessageId = clientMessageId,
            ChannelId = channelId,
            MessageId = hydrated.Id,
            AuthorId = hydrated.UserId,
            Content = hydrated.ContentText ?? "",
            CreatedAt = hydrated.CreatedAt,
            Author = new DmAuthorSnapshot
            {
                Id = hydrated.User.Id,
                Username = hydrated.User.UserName!,
                DisplayName = hydrated.User.DisplayName,
                AvatarUrl = hydrated.User.AvatarUrl
            },
            Attachments = hydrated.Attachments.Select(a => new MessageAttachmentSnapshot
            {
                Id = a.Id,
                FileName = a.FileName,
                ContentType = a.ContentType,
                Size = a.Size,
                Url = a.Url
            }).ToList()
        });

        return Ok(MessageDto.From(hydrated, clientMessageId));
    }
}
