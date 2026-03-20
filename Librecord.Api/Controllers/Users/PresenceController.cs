using System.Security.Claims;
using Librecord.Api.Hubs;
using Librecord.Application.Messaging;
using Librecord.Application.Users;
using Librecord.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Controllers.Users;

[ApiController]
[Authorize]
[Route("presence")]
public class PresenceController : ControllerBase
{
    private readonly IPresenceService _presence;
    private readonly IDirectMessageChannelService _dmChannels;
    private readonly IHubContext<DmHub> _dmHub;

    public PresenceController(
        IPresenceService presence,
        IDirectMessageChannelService dmChannels,
        IHubContext<DmHub> dmHub)
    {
        _presence = presence;
        _dmChannels = dmChannels;
        _dmHub = dmHub;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // SET STATUS
    // ---------------------------------------------------------
    [HttpPut]
    public async Task<IActionResult> SetStatus([FromBody] SetStatusRequest request)
    {
        // Frontend sends "offline" for invisible
        var statusStr = request.Status.Equals("offline", StringComparison.OrdinalIgnoreCase)
            ? "Invisible"
            : request.Status;

        if (!Enum.TryParse<UserStatus>(statusStr, true, out var status))
            return BadRequest("Invalid status.");

        await _presence.SetStatusAsync(UserId, status);

        // Broadcast to DM channels — invisible users appear as "offline" to others
        var broadcastStatus = status == UserStatus.Invisible
            ? "offline"
            : status.ToString().ToLowerInvariant();

        var channels = await _dmChannels.GetUserChannelsAsync(UserId);
        foreach (var channel in channels)
        {
            await _dmHub.Clients
                .Group(DmHub.ChannelGroup(channel.Id))
                .SendAsync("dm:user:presence", new { userId = UserId, status = broadcastStatus });
        }

        var returnStatus = status == UserStatus.Invisible ? "offline" : status.ToString().ToLowerInvariant();
        return Ok(new { status = returnStatus });
    }

    // ---------------------------------------------------------
    // GET MY STATUS
    // ---------------------------------------------------------
    [HttpGet("me")]
    public async Task<IActionResult> GetMyPresence()
    {
        var presence = await _presence.GetPresenceAsync(UserId);

        var status = presence?.Status switch
        {
            UserStatus.Invisible => "offline",
            null => "online",
            _ => presence.Status.ToString().ToLowerInvariant()
        };
        return Ok(new { status });
    }

    // ---------------------------------------------------------
    // GET BULK PRESENCE
    // ---------------------------------------------------------
    [HttpPost("bulk")]
    public async Task<IActionResult> GetBulk([FromBody] BulkPresenceRequest request)
    {
        if (request.UserIds == null || request.UserIds.Count == 0)
            return Ok(new { });

        var presences = await _presence.GetBulkPresenceAsync(request.UserIds);

        var result = presences.ToDictionary(
            kv => kv.Key.ToString(),
            kv => kv.Value == UserStatus.Invisible ? "offline" : kv.Value.ToString().ToLowerInvariant()
        );

        return Ok(result);
    }
}

public class SetStatusRequest
{
    public string Status { get; set; } = "";
}

public class BulkPresenceRequest
{
    public List<Guid> UserIds { get; set; } = [];
}
