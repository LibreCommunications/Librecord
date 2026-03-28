using System.Security.Claims;
using Librecord.Api.Dtos.Messages;
using Librecord.Api.Requests;
using Librecord.Api.Requests.Messages;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("guild-channels/{channelId:guid}/messages")]
public sealed class GuildChannelMessagesController(
    IGuildChannelMessageService guildChannelMessages,
    IPermissionService permissions)
    : AuthenticatedController
{
    [HttpGet("{messageId:guid}")]
    public async Task<IActionResult> Get(
        Guid channelId,
        Guid messageId)
    {
        var message = await guildChannelMessages.GetMessageAsync(messageId);
        if (message?.GuildContext == null ||
            message.GuildContext.ChannelId != channelId)
            return NotFound();

        var access = await permissions.HasChannelPermissionAsync(
            UserId,
            channelId,
            ChannelPermission.ReadMessages);

        if (!access.Allowed)
            return Forbid();

        return Ok(MessageDto.From(message));
    }

    [HttpGet]
    public async Task<IActionResult> GetChannelMessages(
        Guid channelId,
        [FromQuery] int limit = 50,
        [FromQuery] Guid? before = null)
    {
        var access = await permissions.HasChannelPermissionAsync(
            UserId,
            channelId,
            ChannelPermission.ReadMessages);

        if (!access.Allowed)
            return Forbid();

        var result = await guildChannelMessages.GetChannelMessagesAsync(
            channelId,
            Math.Clamp(limit, 1, 100),
            before);
        
        return Ok(result.Select(m => MessageDto.From(m)));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        Guid channelId,
        [FromBody] CreateMessageRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Message content required.");

        var access = await permissions.HasChannelPermissionAsync(
            UserId,
            channelId,
            ChannelPermission.SendMessages);

        if (!access.Allowed)
            return Forbid();

        var message = await guildChannelMessages.CreateMessageAsync(
            channelId,
            UserId,
            dto.Content.Trim(),
            dto.ClientMessageId,
            replyToMessageId: dto.ReplyToMessageId);

        return Ok(MessageDto.From(message));
    }

    [HttpPut("{messageId:guid}")]
    public async Task<IActionResult> Update(
        Guid channelId,
        Guid messageId,
        [FromBody] UpdateMessageRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Message content required.");

        try
        {
            var updated = await guildChannelMessages.EditMessageAsync(
                messageId,
                UserId,
                dto.Content.Trim());

            if (updated.GuildContext?.ChannelId != channelId)
                return NotFound();

            return Ok(MessageDto.From(updated));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{messageId:guid}")]
    public async Task<IActionResult> Delete(
        Guid channelId,
        Guid messageId)
    {
        try
        {
            var message = await guildChannelMessages.GetMessageAsync(messageId);
            if (message?.GuildContext?.ChannelId != channelId)
                return NotFound();

            await guildChannelMessages.DeleteMessageAsync(messageId);
            return Ok();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
    }
}
