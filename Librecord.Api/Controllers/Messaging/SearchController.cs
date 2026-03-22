using Librecord.Application.Messaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers.Messaging;

[ApiController]
[Authorize]
[Route("search")]
public class SearchController : AuthenticatedController
{
    private readonly IMessageSearchService _search;

    public SearchController(IMessageSearchService search)
    {
        _search = search;
    }

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] Guid? channelId = null,
        [FromQuery] Guid? guildId = null,
        [FromQuery] int limit = 25)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("Search query is required.");

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
