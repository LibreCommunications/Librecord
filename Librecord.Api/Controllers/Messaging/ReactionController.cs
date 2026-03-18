using System.Security.Claims;
using Librecord.Application.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("messages/{messageId:guid}/reactions")]
public class ReactionController : ControllerBase
{
    private readonly IReactionService _reactions;

    public ReactionController(IReactionService reactions)
    {
        _reactions = reactions;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // ADD REACTION
    // ---------------------------------------------------------
    [HttpPut("{emoji}")]
    public async Task<IActionResult> Add(Guid messageId, string emoji)
    {
        try
        {
            var reaction = await _reactions.AddReactionAsync(messageId, UserId, emoji);
            return Ok(new
            {
                messageId = reaction.MessageId,
                userId = reaction.UserId,
                emoji = reaction.Emoji
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // ---------------------------------------------------------
    // REMOVE REACTION
    // ---------------------------------------------------------
    [HttpDelete("{emoji}")]
    public async Task<IActionResult> Remove(Guid messageId, string emoji)
    {
        await _reactions.RemoveReactionAsync(messageId, UserId, emoji);
        return Ok();
    }
}
