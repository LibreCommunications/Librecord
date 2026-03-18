using System.Security.Claims;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Guilds;

[ApiController]
[Authorize]
[Route("guilds/{guildId:guid}/roles")]
public class GuildRoleController : ControllerBase
{
    private readonly IRoleRepository _roles;
    private readonly IGuildRepository _guilds;
    private readonly IPermissionService _permissions;

    public GuildRoleController(
        IRoleRepository roles,
        IGuildRepository guilds,
        IPermissionService permissions)
    {
        _roles = roles;
        _guilds = guilds;
        _permissions = permissions;
    }

    private Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------------------------------------------------------
    // LIST ROLES
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> List(Guid guildId)
    {
        var guild = await _guilds.GetGuildAsync(guildId);
        if (guild == null) return NotFound();

        if (await _guilds.GetGuildMemberAsync(guildId, UserId) == null)
            return Forbid();

        var roles = guild.Roles
            .OrderByDescending(r => r.Position)
            .Select(r => new
            {
                id = r.Id,
                name = r.Name,
                position = r.Position,
                permissions = r.Permissions.Select(p => new
                {
                    permissionId = p.PermissionId,
                    allow = p.Allow
                })
            });

        return Ok(roles);
    }

    // ---------------------------------------------------------
    // CREATE ROLE
    // ---------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create(Guid guildId, [FromBody] CreateRoleRequest req)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.ManageRoles);
        if (!perm.Allowed) return Forbid();

        var guild = await _guilds.GetGuildAsync(guildId);
        if (guild == null) return NotFound();

        var maxPos = guild.Roles.Any() ? guild.Roles.Max(r => r.Position) : 0;

        var role = new GuildRole
        {
            Id = Guid.NewGuid(),
            GuildId = guildId,
            Name = req.Name?.Trim() ?? "New Role",
            Position = maxPos + 1
        };

        await _roles.AddRoleAsync(role);
        await _roles.SaveChangesAsync();

        return Ok(new
        {
            id = role.Id,
            name = role.Name,
            position = role.Position
        });
    }

    // ---------------------------------------------------------
    // UPDATE ROLE
    // ---------------------------------------------------------
    [HttpPut("{roleId:guid}")]
    public async Task<IActionResult> Update(Guid guildId, Guid roleId, [FromBody] UpdateRoleRequest req)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.ManageRoles);
        if (!perm.Allowed) return Forbid();

        var role = await _roles.GetRoleAsync(roleId);
        if (role == null || role.GuildId != guildId) return NotFound();

        if (req.Name != null)
            role.Name = req.Name.Trim();

        if (req.Position.HasValue)
            role.Position = req.Position.Value;

        await _roles.UpdateRoleAsync(role);
        await _roles.SaveChangesAsync();

        return Ok(new
        {
            id = role.Id,
            name = role.Name,
            position = role.Position
        });
    }

    // ---------------------------------------------------------
    // DELETE ROLE
    // ---------------------------------------------------------
    [HttpDelete("{roleId:guid}")]
    public async Task<IActionResult> Delete(Guid guildId, Guid roleId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.ManageRoles);
        if (!perm.Allowed) return Forbid();

        var role = await _roles.GetRoleAsync(roleId);
        if (role == null || role.GuildId != guildId) return NotFound();

        if (role.Name is "@everyone" or "Owner")
            return BadRequest("Cannot delete this role.");

        await _roles.DeleteRoleAsync(role);
        await _roles.SaveChangesAsync();

        return Ok();
    }

    // ---------------------------------------------------------
    // SET ROLE PERMISSION
    // ---------------------------------------------------------
    [HttpPut("{roleId:guid}/permissions/{permissionId:guid}")]
    public async Task<IActionResult> SetPermission(
        Guid guildId, Guid roleId, Guid permissionId, [FromBody] SetPermissionRequest req)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.ManageRoles);
        if (!perm.Allowed) return Forbid();

        var role = await _roles.GetRoleAsync(roleId);
        if (role == null || role.GuildId != guildId) return NotFound();

        if (req.Allow)
            await _roles.AddPermissionToRoleAsync(roleId, permissionId, true);
        else
            await _roles.RemovePermissionFromRoleAsync(roleId, permissionId);

        await _roles.SaveChangesAsync();
        return Ok();
    }

    // ---------------------------------------------------------
    // ASSIGN ROLE TO MEMBER
    // ---------------------------------------------------------
    [HttpPost("{roleId:guid}/members/{userId:guid}")]
    public async Task<IActionResult> AssignToMember(Guid guildId, Guid roleId, Guid userId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.ManageRoles);
        if (!perm.Allowed) return Forbid();

        var role = await _roles.GetRoleAsync(roleId);
        if (role == null || role.GuildId != guildId) return NotFound();

        var member = await _guilds.GetGuildMemberAsync(guildId, userId);
        if (member == null) return NotFound("Member not found.");

        if (member.Roles.Any(r => r.RoleId == roleId))
            return Ok();

        member.Roles.Add(new GuildMemberRole
        {
            UserId = userId,
            GuildId = guildId,
            RoleId = roleId
        });

        await _guilds.SaveChangesAsync();
        return Ok();
    }

    // ---------------------------------------------------------
    // REMOVE ROLE FROM MEMBER
    // ---------------------------------------------------------
    [HttpDelete("{roleId:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveFromMember(Guid guildId, Guid roleId, Guid userId)
    {
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.ManageRoles);
        if (!perm.Allowed) return Forbid();

        var member = await _guilds.GetGuildMemberAsync(guildId, userId);
        if (member == null) return NotFound();

        var memberRole = member.Roles.FirstOrDefault(r => r.RoleId == roleId);
        if (memberRole != null)
        {
            member.Roles.Remove(memberRole);
            await _guilds.SaveChangesAsync();
        }

        return Ok();
    }
}

public class CreateRoleRequest { public string? Name { get; set; } }
public class UpdateRoleRequest { public string? Name { get; set; } public int? Position { get; set; } }
public class SetPermissionRequest { public bool Allow { get; set; } }
