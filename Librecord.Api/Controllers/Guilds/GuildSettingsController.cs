using Librecord.Application.Guilds;
using Librecord.Application.Permissions;
using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("guilds")]
public class GuildSettingsController : AuthenticatedController
{
    private readonly IGuildSettingsService _settings;
    private readonly IPermissionService _permissions;
    private readonly IGuildRealtimeNotifier _guildNotifier;

    public GuildSettingsController(
        IGuildSettingsService settings,
        IPermissionService permissions,
        IGuildRealtimeNotifier guildNotifier)
    {
        _settings = settings;
        _permissions = permissions;
        _guildNotifier = guildNotifier;
    }

    [Authorize]
    [HttpPost("{guildId}/icon")]
    public async Task<IActionResult> UploadGuildIcon(Guid guildId, IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Invalid file");

        var permission = await _permissions.HasGuildPermissionAsync(
            UserId, guildId, GuildPermission.ManageGuild);

        if (!permission.Allowed)
            return Forbid(permission.Error ?? "Missing permission");

        await using var stream = file.OpenReadStream();
        var iconUrl = await _settings.UploadGuildIconAsync(guildId, stream, file.FileName, file.ContentType);
        if (iconUrl == null) return NotFound();

        return Ok(new { iconUrl });
    }

    [Authorize]
    [HttpPut("{guildId:guid}")]
    public async Task<IActionResult> UpdateGuild(Guid guildId, [FromBody] UpdateGuildRequest request)
    {
        var permission = await _permissions.HasGuildPermissionAsync(
            UserId, guildId, GuildPermission.ManageGuild);

        if (!permission.Allowed)
            return Forbid();

        var guild = await _settings.UpdateGuildAsync(guildId, request.Name);
        if (guild == null) return NotFound();

        return Ok(new
        {
            id = guild.Id,
            name = guild.Name,
            iconUrl = guild.IconUrl
        });
    }

    [Authorize]
    [HttpDelete("{guildId:guid}")]
    public async Task<IActionResult> DeleteGuild(Guid guildId)
    {
        var permission = await _permissions.HasGuildPermissionAsync(
            UserId, guildId, GuildPermission.ManageGuild);

        if (!permission.Allowed)
            return Forbid();

        var (success, channelIds) = await _settings.DeleteGuildAsync(guildId);
        if (!success) return NotFound();

        await _guildNotifier.NotifyGuildDeletedAsync(new GuildDeleted
        {
            GuildId = guildId,
            ChannelIds = channelIds
        });

        return Ok();
    }
}

public class UpdateGuildRequest
{
    public string? Name { get; set; }
}
