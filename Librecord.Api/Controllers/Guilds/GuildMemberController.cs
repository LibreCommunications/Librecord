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
        var granted = await _permissions.GetGrantedGuildPermissionsAsync(UserId, guildId);
        if (granted == null) return Forbid();

        var guild = await _guilds.GetGuildAsync(guildId);

        return Ok(new
        {
            isOwner = guild?.OwnerId == UserId,
            manageGuild = granted.Contains(GuildPermission.ManageGuild),
            manageChannels = granted.Contains(GuildPermission.ManageChannels),
            manageRoles = granted.Contains(GuildPermission.ManageRoles),
            kickMembers = granted.Contains(GuildPermission.KickMembers),
            banMembers = granted.Contains(GuildPermission.BanMembers),
            inviteMembers = granted.Contains(GuildPermission.InviteMembers),
        });
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
