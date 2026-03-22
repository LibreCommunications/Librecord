using System.Security.Claims;
using Librecord.Domain.Social;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Api.Controllers.Social;

[ApiController]
[Authorize]
[Route("blocks")]
public class BlockController : AuthenticatedController
{
    private readonly LibrecordContext _db;

    public BlockController(LibrecordContext db)
    {
        _db = db;
    }
    // ---------------------------------------------------------
    // BLOCK USER
    // ---------------------------------------------------------
    [HttpPut("{userId:guid}")]
    public async Task<IActionResult> Block(Guid userId)
    {
        if (userId == UserId)
            return BadRequest("Cannot block yourself.");

        var existing = await _db.UserBlocks
            .FirstOrDefaultAsync(b => b.BlockerId == UserId && b.BlockedId == userId);

        if (existing != null) return Ok();

        _db.UserBlocks.Add(new UserBlock
        {
            BlockerId = UserId,
            BlockedId = userId,
            CreatedAt = DateTime.UtcNow
        });

        // Remove any friendship
        var friendships = await _db.Friendships
            .Where(f =>
                (f.RequesterId == UserId && f.TargetId == userId) ||
                (f.RequesterId == userId && f.TargetId == UserId))
            .ToListAsync();

        _db.Friendships.RemoveRange(friendships);

        await _db.SaveChangesAsync();
        return Ok();
    }

    // ---------------------------------------------------------
    // UNBLOCK USER
    // ---------------------------------------------------------
    [HttpDelete("{userId:guid}")]
    public async Task<IActionResult> Unblock(Guid userId)
    {
        var block = await _db.UserBlocks
            .FirstOrDefaultAsync(b => b.BlockerId == UserId && b.BlockedId == userId);

        if (block == null) return NotFound();

        _db.UserBlocks.Remove(block);
        await _db.SaveChangesAsync();
        return Ok();
    }

    // ---------------------------------------------------------
    // LIST BLOCKED USERS
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var blocks = await _db.UserBlocks
            .Where(b => b.BlockerId == UserId)
            .Include(b => b.Blocked)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        return Ok(blocks.Select(b => new
        {
            userId = b.BlockedId,
            username = b.Blocked.UserName,
            displayName = b.Blocked.DisplayName,
            blockedAt = b.CreatedAt
        }));
    }

    // ---------------------------------------------------------
    // CHECK IF BLOCKED
    // ---------------------------------------------------------
    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> IsBlocked(Guid userId)
    {
        var blocked = await _db.UserBlocks
            .AnyAsync(b => b.BlockerId == UserId && b.BlockedId == userId);

        return Ok(new { blocked });
    }
}
