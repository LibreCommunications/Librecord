using System.Security.Claims;
using Librecord.Application.Guilds;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Api.Controllers.Guilds;

[ApiController]
[Authorize]
[Route("guilds/{guildId:guid}")]
public class GuildMemberController : AuthenticatedController
{
    private readonly IGuildService _guilds;
    private readonly IPermissionService _permissions;
    private readonly LibrecordContext _db;

    public GuildMemberController(
        IGuildService guilds,
        IPermissionService permissions,
        LibrecordContext db)
    {
        _guilds = guilds;
        _permissions = permissions;
        _db = db;
    }
    // ---------------------------------------------------------
    // LIST MEMBERS
    // ---------------------------------------------------------
    [HttpGet("members")]
    public async Task<IActionResult> List(Guid guildId)
    {
        if (!await _guilds.IsMemberAsync(guildId, UserId))
            return Forbid();

        var members = await _guilds.GetMembersAsync(guildId);

        return Ok(members.Select(m => new
        {
            userId = m.UserId,
            username = m.User.UserName,
            displayName = m.User.DisplayName,
            avatarUrl = m.User.AvatarUrl,
            joinedAt = m.JoinedAt,
            roles = m.Roles.Select(r => new
            {
                id = r.Role.Id,
                name = r.Role.Name
            })
        }));
    }

    // ---------------------------------------------------------
    // KICK MEMBER
    // ---------------------------------------------------------
    [HttpPost("kick/{userId:guid}")]
    public async Task<IActionResult> Kick(Guid guildId, Guid userId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.KickMembers);
        if (!perm.Allowed) return Forbid();

        if (userId == UserId)
            return BadRequest("Cannot kick yourself.");

        var member = await _db.GuildMembers
            .FirstOrDefaultAsync(m => m.GuildId == guildId && m.UserId == userId);

        if (member == null)
            return NotFound("Member not found.");

        _db.GuildMembers.Remove(member);
        await _db.SaveChangesAsync();

        return Ok();
    }

    // ---------------------------------------------------------
    // BAN MEMBER
    // ---------------------------------------------------------
    [HttpPost("bans/{userId:guid}")]
    public async Task<IActionResult> Ban(Guid guildId, Guid userId, [FromBody] BanRequest? request = null)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.BanMembers);
        if (!perm.Allowed) return Forbid();

        if (userId == UserId)
            return BadRequest("Cannot ban yourself.");

        var existing = await _db.GuildBans
            .FirstOrDefaultAsync(b => b.GuildId == guildId && b.UserId == userId);

        if (existing != null)
            return Ok();

        // Remove from guild if member
        var member = await _db.GuildMembers
            .FirstOrDefaultAsync(m => m.GuildId == guildId && m.UserId == userId);

        if (member != null)
            _db.GuildMembers.Remove(member);

        _db.GuildBans.Add(new GuildBan
        {
            GuildId = guildId,
            UserId = userId,
            ModeratorId = UserId,
            Reason = request?.Reason,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok();
    }

    // ---------------------------------------------------------
    // UNBAN MEMBER
    // ---------------------------------------------------------
    [HttpDelete("bans/{userId:guid}")]
    public async Task<IActionResult> Unban(Guid guildId, Guid userId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.BanMembers);
        if (!perm.Allowed) return Forbid();

        var ban = await _db.GuildBans
            .FirstOrDefaultAsync(b => b.GuildId == guildId && b.UserId == userId);

        if (ban == null) return NotFound();

        _db.GuildBans.Remove(ban);
        await _db.SaveChangesAsync();

        return Ok();
    }

    // ---------------------------------------------------------
    // LIST BANS
    // ---------------------------------------------------------
    [HttpGet("bans")]
    public async Task<IActionResult> ListBans(Guid guildId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.BanMembers);
        if (!perm.Allowed) return Forbid();

        var bans = await _db.GuildBans
            .Where(b => b.GuildId == guildId)
            .Include(b => b.User)
            .Include(b => b.Moderator)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        return Ok(bans.Select(b => new
        {
            userId = b.UserId,
            username = b.User.UserName,
            displayName = b.User.DisplayName,
            moderator = b.Moderator.DisplayName,
            reason = b.Reason,
            createdAt = b.CreatedAt
        }));
    }
}

public class BanRequest
{
    public string? Reason { get; set; }
}
