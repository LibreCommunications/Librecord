using System.Security.Claims;
using Librecord.Api.Dtos.Messages;
using Librecord.Api.Requests.Messages;
using Librecord.Application.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Route("dm-messages")]
[Authorize]
public sealed class DirectMessageController : AuthenticatedController
{
    private readonly IDirectMessageService _dms;

    public DirectMessageController(IDirectMessageService dms)
    {
        _dms = dms;
    }
    [HttpGet("channel/{channelId:guid}")]
    public async Task<IActionResult> GetChannelMessages(
        Guid channelId,
        [FromQuery] int limit = 50,
        [FromQuery] Guid? before = null)
    {
        var messages = await _dms.GetMessagesAsync(
            channelId,
            UserId,
            Math.Clamp(limit, 1, 100),
            before);

        return Ok(messages.Select(x=> MessageDto.From(x)));
    }

    [HttpPost("channel/{channelId:guid}")]
    public async Task<IActionResult> SendMessage(
        Guid channelId,
        [FromBody] SendMessageRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ClientMessageId))
            return BadRequest("ClientMessageId required.");

        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Message content required.");

        var message = await _dms.SendMessageAsync(
            channelId,
            UserId,
            dto.Content,
            dto.ClientMessageId
        );

        return Ok(MessageDto.From(message, dto.ClientMessageId));
    }

    [HttpPut("{messageId:guid}")]
    public async Task<IActionResult> EditMessage(
        Guid messageId,
        [FromBody] EditMessageRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Message content required.");

        var message = await _dms.EditMessageAsync(
            messageId,
            UserId,
            dto.Content);

        if (message == null)
            return NotFound();

        return Ok(MessageDto.From(message));
    }

    [HttpDelete("{messageId:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid messageId)
    {
        var deleted = await _dms.DeleteMessageAsync(messageId, UserId);
        return deleted ? Ok() : NotFound();
    }
}
