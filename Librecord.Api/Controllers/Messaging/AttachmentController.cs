using System.Security.Claims;
using Librecord.Api.Dtos.Messages;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
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
public class GuildMessageWithAttachmentController : ControllerBase
{
    private readonly IGuildChannelMessageService _messages;
    private readonly IPermissionService _permissions;
    private readonly IAttachmentStorageService _storage;
    private readonly LibrecordContext _db;

    public GuildMessageWithAttachmentController(
        IGuildChannelMessageService messages,
        IPermissionService permissions,
        IAttachmentStorageService storage,
        LibrecordContext db)
    {
        _messages = messages;
        _permissions = permissions;
        _storage = storage;
        _db = db;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // SEND MESSAGE WITH ATTACHMENTS
    // ---------------------------------------------------------
    [HttpPost("with-attachments")]
    [RequestSizeLimit(25 * 1024 * 1024)] // 25MB
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

        // Create message (content can be empty if only attachments)
        var message = await _messages.CreateMessageAsync(
            channelId,
            UserId,
            content?.Trim() ?? "",
            clientMessageId);

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

            // Re-fetch to include attachments
            message = (await _messages.GetMessageAsync(message.Id))!;
        }

        return Ok(MessageDto.From(message));
    }
}

// DM version
[ApiController]
[Authorize]
[Route("dm-messages/channel/{channelId:guid}")]
public class DmMessageWithAttachmentController : ControllerBase
{
    private readonly IDirectMessageService _dms;
    private readonly IAttachmentStorageService _storage;
    private readonly LibrecordContext _db;

    public DmMessageWithAttachmentController(
        IDirectMessageService dms,
        IAttachmentStorageService storage,
        LibrecordContext db)
    {
        _dms = dms;
        _storage = storage;
        _db = db;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("with-attachments")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<IActionResult> CreateWithAttachments(
        Guid channelId,
        [FromForm] string? content,
        [FromForm] string? clientMessageId,
        [FromForm] List<IFormFile>? files)
    {
        if (string.IsNullOrWhiteSpace(content) && (files == null || files.Count == 0))
            return BadRequest("Message content or attachments required.");

        var message = await _dms.SendMessageAsync(
            channelId,
            UserId,
            content?.Trim() ?? "",
            clientMessageId);

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

        return Ok(MessageDto.From(message, clientMessageId));
    }
}
