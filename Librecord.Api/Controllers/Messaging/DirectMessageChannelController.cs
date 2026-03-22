using System.Security.Claims;
using Librecord.Api.Hubs;
using Librecord.Application.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Route("dms")]
[Authorize]
public class DirectMessageChannelController : ControllerBase
{
    private readonly IDirectMessageChannelService _dms;
    private readonly IHubContext<DmHub> _dmHub;

    public DirectMessageChannelController(
        IDirectMessageChannelService dms,
        IHubContext<DmHub> dmHub)
    {
        _dms = dms;
        _dmHub = dmHub;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // GET USER DM CHANNELS
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> GetMyDms()
    {
        var channels = await _dms.GetUserChannelsAsync(UserId);

        var result = channels.Select(c =>
        {
            var others = c.Members
                .Where(m => m.UserId != UserId)
                .Select(m => m.User.DisplayName)
                .ToList();

            var name = others.Count > 0
                ? string.Join(", ", others)
                : c.Id.ToString().Split('-')[0];

            return new
            {
                id = c.Id,
                name,
                isGroup = c.IsGroup,
                members = c.Members.Select(m => new
                {
                    id = m.UserId,
                    username = m.User.UserName,
                    displayName = m.User.DisplayName,
                    avatarUrl = m.User.AvatarUrl
                })
            };
        });

        return Ok(result);
    }

    // ---------------------------------------------------------
    // GET DM CHANNEL (DETAIL)
    // ---------------------------------------------------------
    [HttpGet("{channelId:guid}")]
    public async Task<IActionResult> GetChannel(Guid channelId)
    {
        var channel = await _dms.GetChannelAsync(channelId);
        if (channel == null)
            return NotFound();

        if (channel.Members.All(m => m.UserId != UserId))
            return Forbid();

        var others = channel.Members
            .Where(m => m.UserId != UserId)
            .Select(m => m.User.DisplayName)
            .ToList();

        var name = others.Count > 0
            ? string.Join(", ", others)
            : channel.Id.ToString().Split('-')[0];

        return Ok(new
        {
            id = channel.Id,
            name,
            isGroup = channel.IsGroup,
            members = channel.Members.Select(m => new
            {
                id = m.UserId,
                username = m.User.UserName,
                displayName = m.User.DisplayName,
                avatarUrl = m.User.AvatarUrl,
                joinedAt = m.JoinedAt
            })
        });
    }

    // ---------------------------------------------------------
    // START OR REUSE DM
    // ---------------------------------------------------------
    [HttpPost("start/{targetUserId:guid}")]
    public async Task<IActionResult> StartDm(Guid targetUserId)
    {
        var channel = await _dms.StartDmAsync(UserId, targetUserId);

        return Ok(new
        {
            channelId = channel.Id
        });
    }

    // ---------------------------------------------------------
    // CREATE GROUP DM
    // ---------------------------------------------------------
    [HttpPost("group")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest request)
    {
        if (request.MemberIds == null || request.MemberIds.Count == 0)
            return BadRequest("At least one member is required.");

        var channel = await _dms.CreateGroupAsync(UserId, request.MemberIds);

        return Ok(new
        {
            channelId = channel.Id,
            isGroup = true
        });
    }

    // ---------------------------------------------------------
    // ADD PARTICIPANT
    // ---------------------------------------------------------
    [HttpPost("{channelId:guid}/participants/{userId:guid}")]
    public async Task<IActionResult> AddParticipant(
        Guid channelId,
        Guid userId)
    {
        await _dms.AddParticipantAsync(channelId, UserId, userId);
        return Ok();
    }


    // ---------------------------------------------------------
    // LEAVE CHANNEL
    // ---------------------------------------------------------
    [HttpDelete("{channelId:guid}/leave")]
    public async Task<IActionResult> LeaveChannel(Guid channelId)
    {
        await _dms.LeaveChannelAsync(channelId, UserId);

        // Notify remaining members that this user left
        await _dmHub.Clients.Group(DmHub.ChannelGroup(channelId)).SendAsync(
            "dm:member:left",
            new { channelId, userId = UserId });

        return Ok();
    }
}

public class CreateGroupRequest
{
    public List<Guid> MemberIds { get; set; } = [];
}