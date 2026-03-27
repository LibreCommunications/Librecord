using Librecord.Application.Guilds;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Domain.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("search")]
public class SearchController : AuthenticatedController
{
    private readonly IMessageSearchService _search;
    private readonly IPermissionService _permissions;
    private readonly IGuildService _guilds;

    public SearchController(
        IMessageSearchService search,
        IPermissionService permissions,
        IGuildService guilds)
    {
        _search = search;
        _permissions = permissions;
        _guilds = guilds;
    }

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] Guid? channelId = null,
        [FromQuery] Guid? guildId = null,
        [FromQuery] int limit = 25)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length > 256)
            return BadRequest("Search query is required and must be under 256 characters.");

        limit = Math.Clamp(limit, 1, 50);

        if (channelId.HasValue)
        {
            var perm = await _permissions.HasChannelPermissionAsync(UserId, channelId.Value, ChannelPermission.ReadMessages);
            if (!perm.Allowed) return Forbid();
        }
        else if (guildId.HasValue)
        {
            if (!await _guilds.IsMemberAsync(guildId.Value, UserId))
                return Forbid();
        }
        else
        {
            return BadRequest("Either channelId or guildId is required.");
        }

        limit = Math.Clamp(limit, 1, 50);

        var results = await _search.SearchAsync(q, channelId, guildId, limit);

        return Ok(results.Select(r => new
        {
            id = r.Id,
            channelId = r.ChannelId,
            content = r.Content,
            createdAt = r.CreatedAt,
            author = new
            {
                id = r.Author.Id,
                username = r.Author.Username,
                displayName = r.Author.DisplayName,
                avatarUrl = r.Author.AvatarUrl
            }
        }));
    }
}
