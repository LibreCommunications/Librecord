using System.Security.Claims;
using Librecord.Application.Guilds;
using Librecord.Application.Permissions;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Guilds;

[ApiController]
[Authorize]
public class GuildInviteController : AuthenticatedController
{
    private readonly IGuildInviteService _invites;
    private readonly IGuildService _guilds;
    private readonly IPermissionService _permissions;

    public GuildInviteController(
        IGuildInviteService invites,
        IGuildService guilds,
        IPermissionService permissions)
    {
        _invites = invites;
        _guilds = guilds;
        _permissions = permissions;
    }
    [HttpPost("guilds/{guildId:guid}/invites")]
    public async Task<IActionResult> Create(
        Guid guildId,
        [FromBody] CreateInviteRequest? request = null)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.InviteMembers);
        if (!perm.Allowed) return Forbid();

        try
        {
            var invite = await _invites.CreateInviteAsync(
                guildId,
                UserId,
                request?.MaxUses,
                request?.ExpiresInHours.HasValue == true
                    ? TimeSpan.FromHours(request.ExpiresInHours.Value)
                    : null);

            return Ok(MapInvite(invite));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("guilds/{guildId:guid}/invites")]
    public async Task<IActionResult> List(Guid guildId)
    {
        if (!await _guilds.IsMemberAsync(guildId, UserId))
            return Forbid();

        var invites = await _invites.GetGuildInvitesAsync(guildId);

        return Ok(invites.Select(MapInvite));
    }

    [HttpPost("invites/{code}/join")]
    public async Task<IActionResult> Join(string code)
    {
        try
        {
            var guild = await _invites.JoinByCodeAsync(code, UserId);

            return Ok(new
            {
                id = guild.Id,
                name = guild.Name,
                iconUrl = guild.IconUrl
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("invites/{code}")]
    public async Task<IActionResult> GetByCode(string code)
    {
        var invite = await _invites.GetByCodeAsync(code);
        if (invite == null)
            return NotFound();

        if (invite.ExpiresAt.HasValue && invite.ExpiresAt.Value < DateTime.UtcNow)
            return NotFound();

        return Ok(new
        {
            code = invite.Code,
            guild = new
            {
                id = invite.Guild.Id,
                name = invite.Guild.Name,
                iconUrl = invite.Guild.IconUrl
            }
        });
    }

    [HttpDelete("invites/{inviteId:guid}")]
    public async Task<IActionResult> Revoke(Guid inviteId)
    {
        try
        {
            await _invites.RevokeInviteAsync(inviteId, UserId);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ex.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    private static object MapInvite(Domain.Guilds.GuildInvite invite) => new
    {
        id = invite.Id,
        code = invite.Code,
        guildId = invite.GuildId,
        creator = new
        {
            id = invite.Creator.Id,
            username = invite.Creator.UserName,
            displayName = invite.Creator.DisplayName
        },
        maxUses = invite.MaxUses,
        usesCount = invite.UsesCount,
        expiresAt = invite.ExpiresAt,
        createdAt = invite.CreatedAt
    };
}

public class CreateInviteRequest
{
    public int? MaxUses { get; set; }
    public int? ExpiresInHours { get; set; }
}
