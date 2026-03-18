using System.Security.Claims;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Security;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("channels/{channelId:guid}/threads")]
public class ThreadController : ControllerBase
{
    private readonly LibrecordContext _db;
    private readonly IMessageEncryptionService _encryption;

    public ThreadController(LibrecordContext db, IMessageEncryptionService encryption)
    {
        _db = db;
        _encryption = encryption;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // CREATE THREAD FROM MESSAGE
    // ---------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create(Guid channelId, [FromBody] CreateThreadRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Thread name is required.");

        // Verify parent message is in this channel
        var inChannel = await _db.DmChannelMessages
            .AnyAsync(m => m.ChannelId == channelId && m.MessageId == request.ParentMessageId)
            || await _db.GuildChannelMessages
            .AnyAsync(m => m.ChannelId == channelId && m.MessageId == request.ParentMessageId);

        if (!inChannel) return NotFound("Parent message not in this channel.");

        var thread = new MessageThread
        {
            Id = Guid.NewGuid(),
            ParentMessageId = request.ParentMessageId,
            ChannelId = channelId,
            Name = request.Name.Trim(),
            CreatorId = UserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Set<MessageThread>().Add(thread);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = thread.Id,
            name = thread.Name,
            parentMessageId = thread.ParentMessageId,
            channelId = thread.ChannelId,
            createdAt = thread.CreatedAt
        });
    }

    // ---------------------------------------------------------
    // LIST THREADS IN CHANNEL
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> List(Guid channelId)
    {
        var threads = await _db.Set<MessageThread>()
            .Where(t => t.ChannelId == channelId)
            .Include(t => t.Creator)
            .OrderByDescending(t => t.LastMessageAt ?? t.CreatedAt)
            .ToListAsync();

        return Ok(threads.Select(t => new
        {
            id = t.Id,
            name = t.Name,
            parentMessageId = t.ParentMessageId,
            creator = new
            {
                id = t.Creator.Id,
                displayName = t.Creator.DisplayName
            },
            messageCount = t.MessageCount,
            lastMessageAt = t.LastMessageAt,
            createdAt = t.CreatedAt
        }));
    }

    // ---------------------------------------------------------
    // GET THREAD MESSAGES
    // ---------------------------------------------------------
    [HttpGet("{threadId:guid}/messages")]
    public async Task<IActionResult> GetMessages(
        Guid channelId, Guid threadId,
        [FromQuery] int limit = 50,
        [FromQuery] Guid? before = null)
    {
        var thread = await _db.Set<MessageThread>().FindAsync(threadId);
        if (thread == null || thread.ChannelId != channelId)
            return NotFound();

        var query = _db.Set<ThreadMessage>()
            .Where(tm => tm.ThreadId == threadId)
            .Include(tm => tm.Message)
                .ThenInclude(m => m.User)
            .OrderByDescending(tm => tm.Message.CreatedAt)
            .AsQueryable();

        if (before.HasValue)
        {
            var beforeMsg = await _db.Messages.FindAsync(before);
            if (beforeMsg != null)
                query = query.Where(tm => tm.Message.CreatedAt < beforeMsg.CreatedAt);
        }

        var threadMessages = await query.Take(limit).ToListAsync();

        return Ok(threadMessages.Select(tm => new
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

    // ---------------------------------------------------------
    // POST MESSAGE TO THREAD
    // ---------------------------------------------------------
    [HttpPost("{threadId:guid}/messages")]
    public async Task<IActionResult> PostMessage(
        Guid channelId, Guid threadId,
        [FromBody] ThreadMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return BadRequest("Content is required.");

        var thread = await _db.Set<MessageThread>().FindAsync(threadId);
        if (thread == null || thread.ChannelId != channelId)
            return NotFound();

        var encrypted = _encryption.Encrypt(request.Content.Trim());

        var message = new Message
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Content = encrypted.Ciphertext,
            CreatedAt = DateTime.UtcNow
        };

        _db.Messages.Add(message);

        _db.Set<ThreadMessage>().Add(new ThreadMessage
        {
            MessageId = message.Id,
            ThreadId = threadId
        });

        thread.MessageCount++;
        thread.LastMessageAt = message.CreatedAt;

        await _db.SaveChangesAsync();

        var user = await _db.Users.FindAsync(UserId);

        return Ok(new
        {
            id = message.Id,
            content = request.Content.Trim(),
            createdAt = message.CreatedAt,
            author = new
            {
                id = user!.Id,
                username = user.UserName,
                displayName = user.DisplayName,
                avatarUrl = user.AvatarUrl
            }
        });
    }
}

public class CreateThreadRequest
{
    public Guid ParentMessageId { get; set; }
    public string Name { get; set; } = "";
}

public class ThreadMessageRequest
{
    public string Content { get; set; } = "";
}
