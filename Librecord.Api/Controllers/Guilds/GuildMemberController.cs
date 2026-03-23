using Librecord.Application.Guilds;
using Librecord.Application.Permissions;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Guilds;

[ApiController]
[Authorize]
[Route("guilds/{guildId:guid}")]
public class GuildMemberController : AuthenticatedController
{
    private readonly IGuildService _guilds;
    private readonly IGuildMemberService _members;
    private readonly IPermissionService _permissions;

    public GuildMemberController(
        IGuildService guilds,
        IGuildMemberService members,
        IPermissionService permissions)
    {
        _guilds = guilds;
        _members = members;
        _permissions = permissions;
    }

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

    [HttpGet("permissions/me")]
    public async Task<IActionResult> MyPermissions(Guid guildId)
    {
        if (!await _guilds.IsMemberAsync(guildId, UserId))
            return Forbid();

        var result = new Dictionary<string, bool>();
        var checks = new (string key, PermissionCapability perm)[]
        {
            ("manageGuild", GuildPermission.ManageGuild),
            ("manageChannels", GuildPermission.ManageChannels),
            ("manageRoles", GuildPermission.ManageRoles),
            ("kickMembers", GuildPermission.KickMembers),
            ("banMembers", GuildPermission.BanMembers),
            ("inviteMembers", GuildPermission.InviteMembers),
        };

        foreach (var (key, perm) in checks)
        {
            var r = await _permissions.HasGuildPermissionAsync(UserId, guildId, perm);
            result[key] = r.Allowed;
        }

        return Ok(result);
    }

    [HttpPost("kick/{userId:guid}")]
    public async Task<IActionResult> Kick(Guid guildId, Guid userId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.KickMembers);
        if (!perm.Allowed) return Forbid();

        if (userId == UserId)
            return BadRequest("Cannot kick yourself.");

        var kicked = await _members.KickMemberAsync(guildId, userId);
        return kicked ? Ok() : NotFound("Member not found.");
    }

    [HttpPost("bans/{userId:guid}")]
    public async Task<IActionResult> Ban(Guid guildId, Guid userId, [FromBody] BanRequest? request = null)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.BanMembers);
        if (!perm.Allowed) return Forbid();

        if (userId == UserId)
            return BadRequest("Cannot ban yourself.");

        await _members.BanMemberAsync(guildId, userId, UserId, request?.Reason);
        return Ok();
    }

    [HttpDelete("bans/{userId:guid}")]
    public async Task<IActionResult> Unban(Guid guildId, Guid userId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.BanMembers);
        if (!perm.Allowed) return Forbid();

        var unbanned = await _members.UnbanMemberAsync(guildId, userId);
        return unbanned ? Ok() : NotFound();
    }

    [HttpGet("bans")]
    public async Task<IActionResult> ListBans(Guid guildId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.BanMembers);
        if (!perm.Allowed) return Forbid();

        var bans = await _members.GetBansAsync(guildId);

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
