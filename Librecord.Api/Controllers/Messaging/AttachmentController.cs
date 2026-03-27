using Librecord.Api.Dtos.Messages;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Application.Realtime.DMs;
using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("guild-channels/{channelId:guid}/messages")]
[EnableRateLimiting("upload")]
public class GuildMessageWithAttachmentController : AuthenticatedController
{
    private readonly IGuildChannelMessageService _messages;
    private readonly IPermissionService _permissions;
    private readonly IAttachmentService _attachments;
    private readonly IGuildRealtimeNotifier _realtime;

    public GuildMessageWithAttachmentController(
        IGuildChannelMessageService messages,
        IPermissionService permissions,
        IAttachmentService attachments,
        IGuildRealtimeNotifier realtime)
    {
        _messages = messages;
        _permissions = permissions;
        _attachments = attachments;
        _realtime = realtime;
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

        var access = await _permissions.HasChannelPermissionAsync(
            UserId, channelId, ChannelPermission.SendMessages);
        if (!access.Allowed) return Forbid();

        var message = await _messages.CreateMessageAsync(
            channelId, UserId, content?.Trim() ?? "", clientMessageId,
            hasAttachments: files is { Count: > 0 }, skipNotification: true);

        if (files is { Count: > 0 })
        {
            var uploads = files
                .Where(f => f.Length > 0)
                .Select(f => new AttachmentUpload(f.OpenReadStream(), f.FileName, f.ContentType, f.Length))
                .ToList();

            await _attachments.SaveAttachmentsAsync(message.Id, uploads);
        }

        message = (await _messages.GetMessageAsync(message.Id))!;

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
                Id = a.Id, FileName = a.FileName, ContentType = a.ContentType,
                Size = a.Size, Url = a.Url
            }).ToList()
        });

        return Ok(MessageDto.From(message, clientMessageId));
    }
}

[ApiController]
[Authorize]
[Route("dm-messages/channel/{channelId:guid}")]
[EnableRateLimiting("upload")]
public class DmMessageWithAttachmentController : AuthenticatedController
{
    private readonly IDirectMessageService _dms;
    private readonly IAttachmentService _attachments;
    private readonly IDmRealtimeNotifier _realtime;

    public DmMessageWithAttachmentController(
        IDirectMessageService dms,
        IAttachmentService attachments,
        IDmRealtimeNotifier realtime)
    {
        _dms = dms;
        _attachments = attachments;
        _realtime = realtime;
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

        var message = await _dms.SendMessageAsync(
            channelId, UserId, content?.Trim() ?? "", clientMessageId,
            hasAttachments: files is { Count: > 0 }, skipNotification: true);

        if (files is { Count: > 0 })
        {
            var uploads = files
                .Where(f => f.Length > 0)
                .Select(f => new AttachmentUpload(f.OpenReadStream(), f.FileName, f.ContentType, f.Length))
                .ToList();

            await _attachments.SaveAttachmentsAsync(message.Id, uploads);
        }

        var hydrated = (await _dms.GetMessageAsync(message.Id))!;

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
                Id = a.Id, FileName = a.FileName, ContentType = a.ContentType,
                Size = a.Size, Url = a.Url
            }).ToList()
        });

        return Ok(MessageDto.From(hydrated, clientMessageId));
    }
}
