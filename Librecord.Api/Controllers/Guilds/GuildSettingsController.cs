using System.Security.Claims;
using Librecord.Application.Interfaces;
using Librecord.Application.Permissions;
using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Permissions;
using Librecord.Domain.Storage;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("guilds")]
public class GuildSettingsController : ControllerBase
{
    private readonly LibrecordContext _db;
    private readonly IPermissionService _permissions;
    private readonly IAttachmentStorageService _storage;
    private readonly IGuildRealtimeNotifier _guildNotifier;

    public GuildSettingsController(
        IAttachmentStorageService storage,
        LibrecordContext db,
        IPermissionService permissions,
        IGuildRealtimeNotifier guildNotifier)
    {
        _storage = storage;
        _db = db;
        _permissions = permissions;
        _guildNotifier = guildNotifier;
    }

    [Authorize]
    [HttpPost("{guildId}/icon")]
    public async Task<IActionResult> UploadGuildIcon(
        Guid guildId,
        IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Invalid file");

        var userId = Guid.Parse(
            User.FindFirstValue(ClaimTypes.NameIdentifier)!
        );

        // Permission check
        var permission = await _permissions.HasGuildPermissionAsync(
            userId,
            guildId,
            GuildPermission.ManageGuild
        );

        if (!permission.Allowed)
            return Forbid(permission.Error ?? "Missing permission");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var objectName = $"guild-icons/{guildId}{ext}";

        var guild = await _db.Guilds.FindAsync(guildId);
        if (guild == null)
            return NotFound();

        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(objectName, stream, file.ContentType);

        
        guild.IconUrl = $"/cdn/public/{objectName}";
        await _db.SaveChangesAsync();

        return Ok(new { iconUrl = guild.IconUrl });
    }

    // ---------------------------------------------------------
    // UPDATE GUILD NAME
    // ---------------------------------------------------------
    [Authorize]
    [HttpPut("{guildId:guid}")]
    public async Task<IActionResult> UpdateGuild(
        Guid guildId,
        [FromBody] UpdateGuildRequest request)
    {
        var userId = Guid.Parse(
            User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var permission = await _permissions.HasGuildPermissionAsync(
            userId, guildId, GuildPermission.ManageGuild);

        if (!permission.Allowed)
            return Forbid();

        var guild = await _db.Guilds.FindAsync(guildId);
        if (guild == null)
            return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name))
            guild.Name = request.Name.Trim();

        await _db.SaveChangesAsync();

        return Ok(new
        {
            id = guild.Id,
            name = guild.Name,
            iconUrl = guild.IconUrl
        });
    }

    // ---------------------------------------------------------
    // DELETE GUILD (owner only)
    // ---------------------------------------------------------
    [Authorize]
    [HttpDelete("{guildId:guid}")]
    public async Task<IActionResult> DeleteGuild(Guid guildId)
    {
        var userId = Guid.Parse(
            User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var permission = await _permissions.HasGuildPermissionAsync(
            userId, guildId, GuildPermission.ManageGuild);

        if (!permission.Allowed)
            return Forbid();

        var guild = await _db.Guilds.FindAsync(guildId);
        if (guild == null)
            return NotFound();

        // Collect channel IDs before deletion so we can broadcast
        var channelIds = await _db.GuildChannels
            .Where(c => c.GuildId == guildId)
            .Select(c => c.Id)
            .ToListAsync();

        // Notify all connected members before removing from DB
        await _guildNotifier.NotifyGuildDeletedAsync(new GuildDeleted
        {
            GuildId = guildId,
            ChannelIds = channelIds
        });

        _db.Guilds.Remove(guild);
        await _db.SaveChangesAsync();

        return Ok();
    }
}

public class UpdateGuildRequest
{
    public string? Name { get; set; }
}