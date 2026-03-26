using System.Security.Claims;
using Librecord.Application.Realtime.DMs;
using Librecord.Domain.Messaging.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("channels")]
public class ReadStateController : AuthenticatedController
{
    private readonly IReadStateRepository _readStates;
    private readonly IDmRealtimeNotifier _realtime;

    public ReadStateController(IReadStateRepository readStates, IDmRealtimeNotifier realtime)
    {
        _readStates = readStates;
        _realtime = realtime;
    }
    [HttpPost("{channelId:guid}/ack")]
    public async Task<IActionResult> Acknowledge(Guid channelId, [FromBody] AckRequest request)
    {
        await _readStates.UpsertAsync(UserId, channelId, request.MessageId);
        await _readStates.SaveChangesAsync();

        await _realtime.NotifyAsync(new DmReadStateUpdated
        {
            ChannelId = channelId,
            MessageId = request.MessageId,
            UserId = UserId,
            ReadAt = DateTime.UtcNow
        });

        return Ok();
    }

    [HttpPost("unread")]
    public async Task<IActionResult> GetUnreadCounts([FromBody] UnreadRequest request)
    {
        if (request.ChannelIds.Count == 0)
            return Ok(new { });

        var counts = await _readStates.GetUnreadCountsAsync(UserId, request.ChannelIds);

        return Ok(counts.ToDictionary(
            kv => kv.Key.ToString(),
            kv => kv.Value
        ));
    }
}

public class AckRequest
{
    public Guid MessageId { get; set; }
}

public class UnreadRequest
{
    public List<Guid> ChannelIds { get; set; } = [];
}
