using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Guilds;

[ApiController]
[Authorize]
[Route("channels/{channelId:guid}/permissions")]
public class ChannelPermissionController : AuthenticatedController
{
    private readonly IGuildRepository _guilds;
    private readonly IPermissionService _permissions;

    public ChannelPermissionController(
        IGuildRepository guilds,
        IPermissionService permissions)
    {
        _guilds = guilds;
        _permissions = permissions;
    }

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

        await _permissions.SetChannelOverrideAsync(
            channelId, req.RoleId, req.UserId, req.PermissionId, req.Allow);

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
