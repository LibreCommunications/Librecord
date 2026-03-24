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
public class PresenceController : AuthenticatedController
{
    private readonly IPresenceService _presence;
    private readonly IConnectionTracker _connections;
    private readonly IDirectMessageChannelService _dmChannels;
    private readonly IHubContext<AppHub> _hub;

    public PresenceController(
        IPresenceService presence,
        IConnectionTracker connections,
        IDirectMessageChannelService dmChannels,
        IHubContext<AppHub> hub)
    {
        _presence = presence;
        _connections = connections;
        _dmChannels = dmChannels;
        _hub = hub;
    }
    // ---------------------------------------------------------
    // SET STATUS
    // ---------------------------------------------------------
    [HttpPut]
    public async Task<IActionResult> SetStatus([FromBody] SetStatusRequest request)
    {
        // Map frontend names to enum values
        var status = request.Status.ToLowerInvariant() switch
        {
            "online" => UserStatus.Default,
            "offline" => UserStatus.Invisible,
            "idle" => UserStatus.Idle,
            "donotdisturb" => UserStatus.DoNotDisturb,
            _ => (UserStatus?)null
        };

        if (status is null)
            return BadRequest("Invalid status.");

        await _presence.SetStatusAsync(UserId, status.Value);

        // Broadcast to DM channels — invisible users appear as "offline" to others
        var broadcastStatus = ResolveAppearance(status.Value, isConnected: true);

        var channels = await _dmChannels.GetUserChannelsAsync(UserId);
        foreach (var channel in channels)
        {
            await _hub.Clients
                .Group(AppHub.DmGroup(channel.Id))
                .SendAsync("dm:user:presence", new { userId = UserId, status = broadcastStatus });
        }

        return Ok(new { status = StatusToSelf(status.Value) });
    }

    // ---------------------------------------------------------
    // GET MY STATUS
    // ---------------------------------------------------------
    [HttpGet("me")]
    public async Task<IActionResult> GetMyPresence()
    {
        var presence = await _presence.GetPresenceAsync(UserId);
        var status = StatusToSelf(presence?.Status ?? UserStatus.Default);
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
        var onlineUsers = _connections.GetOnlineUsers(request.UserIds);

        var result = new Dictionary<string, string>();
        foreach (var userId in request.UserIds)
        {
            var isConnected = onlineUsers.Contains(userId);
            presences.TryGetValue(userId, out var storedStatus);
            result[userId.ToString()] = ResolveAppearance(storedStatus, isConnected);
        }

        return Ok(result);
    }

    /// <summary>
    /// Resolves what status to show to other users based on stored preference and connection state.
    /// </summary>
    private static string ResolveAppearance(UserStatus storedStatus, bool isConnected) => storedStatus switch
    {
        UserStatus.Invisible => "offline",
        UserStatus.Idle when isConnected => "idle",
        UserStatus.DoNotDisturb when isConnected => "donotdisturb",
        _ when isConnected => "online",
        _ => "offline"
    };

    /// <summary>
    /// Maps stored status to what the user sees as their own chosen status.
    /// </summary>
    private static string StatusToSelf(UserStatus status) => status switch
    {
        UserStatus.Default => "online",
        UserStatus.Idle => "idle",
        UserStatus.DoNotDisturb => "donotdisturb",
        UserStatus.Invisible => "offline",
        _ => "online"
    };
}

public class SetStatusRequest
{
    public string Status { get; set; } = "";
}

public class BulkPresenceRequest
{
    public List<Guid> UserIds { get; set; } = [];
}
