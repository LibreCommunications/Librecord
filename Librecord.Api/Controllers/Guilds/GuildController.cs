using System.Security.Claims;
using Librecord.Application.Guilds;
using Librecord.Application.Interfaces;
using Librecord.Domain.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("guilds")]
[Authorize]
public class GuildController : AuthenticatedController
{
    private readonly IGuildService _guilds;

    public GuildController(IGuildService guilds)
    {
        _guilds = guilds;
    }
    // ---------------------------------------------------------
    // CREATE GUILD
    // ---------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGuildDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Guild name is required.");

        var guild = await _guilds.CreateGuildAsync(UserId, dto.Name);

        return Ok(new
        {
            id = guild.Id,
            name = guild.Name,
            iconUrl = guild.IconUrl
        });
    }

    // ---------------------------------------------------------
    // LIST GUILDS FOR CURRENT USER
    // ---------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var guilds = await _guilds.GetGuildsForUserAsync(UserId);

        return Ok(guilds.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            iconUrl = g.IconUrl
        }));
    }

    // ---------------------------------------------------------
    // GET GUILD DETAILS
    // ---------------------------------------------------------
    [HttpGet("{guildId:guid}")]
    public async Task<IActionResult> Get(Guid guildId)
    {
        var guild = await _guilds.GetGuildAsync(guildId);
        if (guild == null)
            return NotFound();

        if (!await _guilds.IsMemberAsync(guildId, UserId))
            return Forbid();

        return Ok(new
        {
            id = guild.Id,
            name = guild.Name,
            iconUrl = guild.IconUrl,
            createdAt = guild.CreatedAt
        });
    }

    // ---------------------------------------------------------
    // GET CHANNELS FOR GUILD
    // ---------------------------------------------------------
    [HttpGet("{guildId:guid}/channels")]
    public async Task<IActionResult> GetChannels(Guid guildId)
    {
        if (!await _guilds.IsMemberAsync(guildId, UserId))
            return Forbid();

        var guild = await _guilds.GetGuildAsync(guildId);
        if (guild == null)
            return NotFound();

        return Ok(
            guild.Channels
                .OrderBy(c => c.Position)
                .Select(c => new
                {
                    id = c.Id,
                    name = c.Name,
                    type = c.Type,
                    parentId = c.ParentId
                })
        );
    }

    [HttpGet("channels/{channelId:guid}")]
    public async Task<IActionResult> GetChannel(Guid channelId)
    {
        var channel = await _guilds.GetChannelAsync(channelId);
        if (channel == null)
            return NotFound();

        if (!await _guilds.CanAccessChannelAsync(channelId, UserId))
            return Forbid();

        return Ok(new
        {
            id = channel.Id,
            name = channel.Name,
            type = channel.Type,
            topic = channel.Topic,
            guildId = channel.GuildId
        });
    }
}