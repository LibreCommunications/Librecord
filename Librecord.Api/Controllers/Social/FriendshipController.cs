using System.Security.Claims;
using Librecord.Api.Dtos.Friendships;
using Librecord.Api.Dtos.User;
using Librecord.Api.Requests;
using Librecord.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Social;

[ApiController]
[Authorize]
[Route("friends")]
public class FriendshipController : AuthenticatedController
{
    private readonly IFriendshipService _friends;

    public FriendshipController(IFriendshipService friends)
    {
        _friends = friends;
    }
    // -------------------------------
    // SEND REQUEST
    // -------------------------------
    [HttpPost("request")]
    public async Task<ActionResult<FriendshipActionDto>> SendRequest(
        [FromBody] SendFriendRequestRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
            return BadRequest(new FriendshipActionDto
            {
                Success = false,
                Error = "Username required."
            });

        var result = await _friends.SendRequestAsync(UserId, request.Username);

        if (!result.Success)
            return BadRequest(new FriendshipActionDto
            {
                Success = false,
                Error = result.Error
            });

        return Ok(new FriendshipActionDto { Success = true });
    }
    // -------------------------------
    // LIST FRIENDS
    // -------------------------------
    [HttpGet("list")]
    public async Task<ActionResult<IReadOnlyList<FriendshipListDto>>> List()
    {
        var friends = await _friends.GetFriendsAsync(UserId);

        return Ok(friends.Select(FriendshipListDto.From));
    }
    // -------------------------------
    // INCOMING + OUTGOING REQUESTS
    // -------------------------------
    [HttpGet("requests")]
    public async Task<IActionResult> Requests()
    {
        var (incoming, outgoing) = await _friends.GetRequestsAsync(UserId);

        return Ok(new
        {
            incoming = incoming.Select(FriendshipListDto.From),
            outgoing = outgoing.Select(FriendshipListDto.From)
        });
    }

    // -------------------------------
    // ACCEPT
    // -------------------------------
    [HttpPost("accept/{requesterId:guid}")]
    public async Task<ActionResult<FriendshipActionDto>> Accept(Guid requesterId)
    {
        var result = await _friends.AcceptRequestAsync(UserId, requesterId);

        return result.Success
            ? Ok(new FriendshipActionDto { Success = true })
            : BadRequest(new FriendshipActionDto
            {
                Success = false,
                Error = result.Error
            });
    }

    // -------------------------------
    // DECLINE
    // -------------------------------
    [HttpPost("decline/{requesterId:guid}")]
    public async Task<ActionResult<FriendshipActionDto>> Decline(Guid requesterId)
    {
        var result = await _friends.DeclineRequestAsync(UserId, requesterId);

        return result.Success
            ? Ok(new FriendshipActionDto { Success = true })
            : BadRequest(new FriendshipActionDto
            {
                Success = false,
                Error = result.Error
            });
    }

    // -------------------------------
    // REMOVE
    // -------------------------------
    [HttpDelete("remove/{friendId:guid}")]
    public async Task<ActionResult<FriendshipActionDto>> Remove(Guid friendId)
    {
        var result = await _friends.RemoveFriendAsync(UserId, friendId);

        return result.Success
            ? Ok(new FriendshipActionDto { Success = true })
            : BadRequest(new FriendshipActionDto
            {
                Success = false,
                Error = result.Error
            });
    }

    // -------------------------------
    // USERNAME SUGGESTIONS
    // -------------------------------
    [HttpGet("suggest")]
    public async Task<ActionResult<IReadOnlyList<UserSuggestionDto>>> Suggest(
        [FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Ok(Array.Empty<UserSuggestionDto>());

        var users = await _friends.SuggestUsernamesAsync(query, UserId);

        var result = users.Select(u => new UserSuggestionDto
        {
            UserId = u.UserId,
            Username = u.Username,
            DisplayName = u.DisplayName,
            AvatarUrl = u.AvatarUrl
        });

        return Ok(result);
    }
}