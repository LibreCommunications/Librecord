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
[Route("channels/{channelId:guid}/permissions")]
public class ChannelPermissionController : AuthenticatedController
{
    private readonly IGuildRepository _guilds;
    private readonly IPermissionService _permissions;
    private readonly LibrecordContext _db;

    public ChannelPermissionController(
        IGuildRepository guilds,
        IPermissionService permissions,
        LibrecordContext db)
    {
        _guilds = guilds;
        _permissions = permissions;
        _db = db;
    }
    // ---------------------------------------------------------
    // LIST OVERRIDES FOR CHANNEL
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> List(Guid channelId)
    {
        var channel = await _guilds.GetChannelAsync(channelId);
        if (channel == null) return NotFound();

        var perm = await _permissions.HasGuildPermissionAsync(
            UserId, channel.GuildId, GuildPermission.ManageChannels);
        if (!perm.Allowed) return Forbid();

        var overrides = await _guilds.GetChannelOverridesAsync(channelId);

        return Ok(overrides.Select(o => new
        {
            id = o.Id,
            channelId = o.ChannelId,
            roleId = o.RoleId,
            userId = o.UserId,
            permissionId = o.PermissionId,
            allow = o.Allow,
        }));
    }

    // ---------------------------------------------------------
    // SET OVERRIDE (role or user)
    // ---------------------------------------------------------
    [HttpPut]
    public async Task<IActionResult> Set(
        Guid channelId,
        [FromBody] SetChannelOverrideRequest req)
    {
        var channel = await _guilds.GetChannelAsync(channelId);
        if (channel == null) return NotFound();

        var perm = await _permissions.HasGuildPermissionAsync(
            UserId, channel.GuildId, GuildPermission.ManageChannels);
        if (!perm.Allowed) return Forbid();

        if (req.RoleId == null && req.UserId == null)
            return BadRequest("Either roleId or userId is required.");

        if (req.RoleId != null && req.UserId != null)
            return BadRequest("Cannot set both roleId and userId.");

        var existing = await _db.GuildChannelPermissionOverrides
            .FirstOrDefaultAsync(o =>
                o.ChannelId == channelId &&
                o.PermissionId == req.PermissionId &&
                o.RoleId == req.RoleId &&
                o.UserId == req.UserId);

        if (req.Allow == null)
        {
            if (existing != null)
            {
                _db.GuildChannelPermissionOverrides.Remove(existing);
                await _db.SaveChangesAsync();
            }
            return Ok();
        }

        if (existing != null)
        {
            existing.Allow = req.Allow;
        }
        else
        {
            _db.GuildChannelPermissionOverrides.Add(new GuildChannelPermissionOverride
            {
                Id = Guid.NewGuid(),
                ChannelId = channelId,
                RoleId = req.RoleId,
                UserId = req.UserId,
                PermissionId = req.PermissionId,
                Allow = req.Allow,
            });
        }

        await _db.SaveChangesAsync();
        return Ok();
    }
}

public class SetChannelOverrideRequest
{
    public Guid? RoleId { get; set; }
    public Guid? UserId { get; set; }
    public Guid PermissionId { get; set; }
    public bool? Allow { get; set; }
}
