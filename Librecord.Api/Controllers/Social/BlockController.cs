using Librecord.Application.Social;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Social;

[ApiController]
[Authorize]
[Route("blocks")]
public class BlockController : AuthenticatedController
{
    private readonly IBlockService _blocks;

    public BlockController(IBlockService blocks)
    {
        _blocks = blocks;
    }

    [HttpPut("{userId:guid}")]
    public async Task<IActionResult> Block(Guid userId)
    {
        if (userId == UserId)
            return BadRequest("Cannot block yourself.");

        await _blocks.BlockUserAsync(UserId, userId);
        return Ok();
    }

    [HttpDelete("{userId:guid}")]
    public async Task<IActionResult> Unblock(Guid userId)
    {
        var removed = await _blocks.UnblockUserAsync(UserId, userId);
        return removed ? Ok() : NotFound();
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var blocks = await _blocks.GetBlockedUsersAsync(UserId);
        return Ok(blocks.Select(b => new
        {
            userId = b.BlockedId,
            username = b.Blocked.UserName,
            displayName = b.Blocked.DisplayName,
            blockedAt = b.CreatedAt
        }));
    }

    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> IsBlocked(Guid userId)
    {
        var blocked = await _blocks.IsBlockedAsync(UserId, userId);
        return Ok(new { blocked });
    }
}
