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
    private readonly IGuildService _guilds;
    private readonly IGuildRealtimeNotifier _guildNotifier;
    private readonly IPermissionService _permissions;

    public GuildSettingsController(
        IGuildSettingsService settings,
        IGuildService guilds,
        IGuildRealtimeNotifier guildNotifier,
        IPermissionService permissions)
    {
        _settings = settings;
        _guilds = guilds;
        _guildNotifier = guildNotifier;
        _permissions = permissions;
    }

    private async Task<bool> IsOwner(Guid guildId)
    {
        var guild = await _guilds.GetGuildAsync(guildId);
        return guild is not null && guild.OwnerId == UserId;
    }

    private async Task<bool> CanManageGuild(Guid guildId)
    {
        if (await IsOwner(guildId)) return true;
        var perm = await _permissions.HasGuildPermissionAsync(UserId, guildId, GuildPermission.ManageGuild);
        return perm.Allowed;
    }

    [Authorize]
    [HttpPost("{guildId}/icon")]
    public async Task<IActionResult> UploadGuildIcon(Guid guildId, IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Invalid file");

        if (!await CanManageGuild(guildId))
            return Forbid();

        await using var stream = file.OpenReadStream();
        var iconUrl = await _settings.UploadGuildIconAsync(guildId, stream, file.FileName, file.ContentType);
        if (iconUrl == null) return NotFound();

        return Ok(new { iconUrl });
    }

    [Authorize]
    [HttpPut("{guildId:guid}")]
    public async Task<IActionResult> UpdateGuild(Guid guildId, [FromBody] UpdateGuildRequest request)
    {
        if (!await CanManageGuild(guildId))
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
        if (!await IsOwner(guildId))
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
    [System.ComponentModel.DataAnnotations.MaxLength(64)]
    public string? Name { get; set; }
}
