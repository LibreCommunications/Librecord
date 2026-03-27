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
public class DirectMessageChannelController : AuthenticatedController
{
    private readonly IDirectMessageChannelService _dms;
    private readonly IHubContext<AppHub> _hub;

    public DirectMessageChannelController(
        IDirectMessageChannelService dms,
        IHubContext<AppHub> hub)
    {
        _dms = dms;
        _hub = hub;
    }
    [HttpGet]
    public async Task<IActionResult> GetMyDms()
    {
        var channels = await _dms.GetUserChannelsAsync(UserId);

        var result = new List<object>();
        foreach (var c in channels)
        {
            var others = c.Members
                .Where(m => m.UserId != UserId)
                .Select(m => m.User?.DisplayName ?? "Unknown")
                .ToList();

            var name = c.IsGroup
                ? (c.Name ?? "Unnamed Group")
                : (others.Count > 0 ? string.Join(", ", others) : c.Id.ToString().Split('-')[0]);

            // For 1-on-1 DMs, include friendship status so the UI knows
            // whether to show the delete button
            bool? isFriend = null;
            if (!c.IsGroup)
            {
                isFriend = await _dms.AreMembersFriendsAsync(c.Id, UserId);
            }

            result.Add(new
            {
                id = c.Id,
                name,
                isGroup = c.IsGroup,
                isFriend,
                members = c.Members.Select(m => new
                {
                    id = m.UserId,
                    username = m.User.UserName,
                    displayName = m.User.DisplayName,
                    avatarUrl = m.User.AvatarUrl
                })
            });
        }

        return Ok(result);
    }

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

        var name = channel.IsGroup
            ? (channel.Name ?? "Unnamed Group")
            : (others.Count > 0 ? string.Join(", ", others) : channel.Id.ToString().Split('-')[0]);

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

    [HttpPost("start/{targetUserId:guid}")]
    public async Task<IActionResult> StartDm(Guid targetUserId)
    {
        var channel = await _dms.StartDmAsync(UserId, targetUserId);

        await _hub.Clients.Users(UserId.ToString(), targetUserId.ToString()).SendAsync(
            "dm:channel:created",
            new { channelId = channel.Id });

        return Ok(new
        {
            channelId = channel.Id
        });
    }

    [HttpPost("group")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest request)
    {
        if (request.MemberIds == null || request.MemberIds.Count == 0)
            return BadRequest("At least one member is required.");

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Group name is required.");

        var channel = await _dms.CreateGroupAsync(UserId, request.MemberIds, request.Name);

        foreach (var memberId in request.MemberIds)
        {
            await _hub.Clients.User(memberId.ToString()).SendAsync(
                "dm:channel:created",
                new { channelId = channel.Id });
        }

        return Ok(new
        {
            channelId = channel.Id,
            isGroup = true
        });
    }

    [HttpPost("{channelId:guid}/participants/{userId:guid}")]
    public async Task<IActionResult> AddParticipant(
        Guid channelId,
        Guid userId)
    {
        await _dms.AddParticipantAsync(channelId, UserId, userId);

        await _hub.Clients.User(userId.ToString()).SendAsync(
            "dm:channel:created",
            new { channelId });

        await _hub.Clients.Group(AppHub.DmGroup(channelId)).SendAsync(
            "dm:member:added",
            new { channelId, userId });

        return Ok();
    }
    [HttpDelete("{channelId:guid}/leave")]
    public async Task<IActionResult> LeaveChannel(Guid channelId)
    {
        await _dms.LeaveChannelAsync(channelId, UserId);

        // Tell the leaving user to leave the SignalR group so they stop
        // receiving messages for this channel (#55)
        await _hub.Clients.User(UserId.ToString()).SendAsync(
            "dm:leave:ack",
            new { channelId });

        await _hub.Clients.Group(AppHub.DmGroup(channelId)).SendAsync(
            "dm:member:left",
            new { channelId, userId = UserId });

        return Ok();
    }

    [HttpDelete("{channelId:guid}")]
    public async Task<IActionResult> DeleteDm(Guid channelId)
    {
        var channel = await _dms.GetChannelAsync(channelId);
        if (channel == null) return NotFound();

        var memberIds = channel.Members.Select(m => m.UserId).ToList();

        await _dms.DeleteDmAsync(channelId, UserId);

        await _hub.Clients.Users(memberIds.Select(id => id.ToString()).ToArray()).SendAsync(
            "dm:channel:deleted",
            new { channelId });

        return Ok();
    }
}

public class CreateGroupRequest
{
    [System.ComponentModel.DataAnnotations.MaxLength(64)]
    public string Name { get; set; } = "";

    [System.ComponentModel.DataAnnotations.MaxLength(10)]
    public List<Guid> MemberIds { get; set; } = [];
}