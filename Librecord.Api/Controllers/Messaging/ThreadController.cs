using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("channels/{channelId:guid}/threads")]
public class ThreadController : AuthenticatedController
{
    private readonly IThreadService _threads;
    private readonly IPermissionService _permissions;
    private readonly IGuildRealtimeNotifier _notifier;

    public ThreadController(IThreadService threads, IPermissionService permissions, IGuildRealtimeNotifier notifier)
    {
        _threads = threads;
        _permissions = permissions;
        _notifier = notifier;
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid channelId, [FromBody] CreateThreadRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Thread name is required.");

        if (!await _threads.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        var access = await _permissions.HasChannelPermissionAsync(UserId, channelId, ChannelPermission.SendMessages);
        if (!access.Allowed) return Forbid();

        var thread = await _threads.CreateThreadAsync(channelId, request.ParentMessageId, request.Name, UserId);
        if (thread == null) return NotFound("Parent message not in this channel.");

        return Ok(new
        {
            id = thread.Id,
            name = thread.Name,
            parentMessageId = thread.ParentMessageId,
            channelId = thread.ChannelId,
            createdAt = thread.CreatedAt
        });
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid channelId)
    {
        if (!await _threads.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        var threads = await _threads.GetThreadsAsync(channelId);

        return Ok(threads.Select(t => new
        {
            id = t.Id,
            name = t.Name,
            parentMessageId = t.ParentMessageId,
            creator = new { id = t.Creator.Id, displayName = t.Creator.DisplayName },
            messageCount = t.MessageCount,
            lastMessageAt = t.LastMessageAt,
            createdAt = t.CreatedAt
        }));
    }

    [HttpGet("{threadId:guid}/messages")]
    public async Task<IActionResult> GetMessages(
        Guid channelId, Guid threadId,
        [FromQuery] int limit = 50,
        [FromQuery] Guid? before = null)
    {
        if (!await _threads.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        var (thread, messages) = await _threads.GetThreadMessagesAsync(threadId, channelId, limit, before);
        if (thread == null) return NotFound();

        return Ok(messages.Select(tm => new
        {
            id = tm.Message.Id,
            content = tm.Message.ContentText ?? "",
            createdAt = tm.Message.CreatedAt,
            editedAt = tm.Message.EditedAt,
            author = new
            {
                id = tm.Message.User.Id,
                username = tm.Message.User.UserName,
                displayName = tm.Message.User.DisplayName,
                avatarUrl = tm.Message.User.AvatarUrl
            }
        }));
    }

    [HttpPost("{threadId:guid}/messages")]
    public async Task<IActionResult> PostMessage(
        Guid channelId, Guid threadId,
        [FromBody] ThreadMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return BadRequest("Content is required.");

        if (!await _threads.IsChannelMemberAsync(channelId, UserId))
            return Forbid();

        var access = await _permissions.HasChannelPermissionAsync(UserId, channelId, ChannelPermission.SendMessages);
        if (!access.Allowed) return Forbid();

        var result = await _threads.PostMessageAsync(threadId, channelId, UserId, request.Content);
        if (result == null) return NotFound();

        await _notifier.NotifyThreadMessageCreatedAsync(new ThreadMessageCreated
        {
            ChannelId = channelId,
            ThreadId = threadId,
            MessageId = result.MessageId,
            Content = result.Content,
            CreatedAt = result.CreatedAt,
            Author = new GuildAuthorSnapshot
            {
                Id = result.Author.Id,
                Username = result.Author.Username ?? "",
                DisplayName = result.Author.DisplayName,
                AvatarUrl = result.Author.AvatarUrl,
            }
        });

        return Ok(new
        {
            id = result.MessageId,
            content = result.Content,
            createdAt = result.CreatedAt,
            author = new
            {
                id = result.Author.Id,
                username = result.Author.Username,
                displayName = result.Author.DisplayName,
                avatarUrl = result.Author.AvatarUrl
            }
        });
    }
}

public class CreateThreadRequest
{
    public Guid ParentMessageId { get; set; }

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(64)]
    public string Name { get; set; } = "";
}

public class ThreadMessageRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(4000)]
    public string Content { get; set; } = "";
}
