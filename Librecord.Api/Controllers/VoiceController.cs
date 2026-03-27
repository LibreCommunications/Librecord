using Librecord.Application.Guilds;
using Librecord.Application.Voice;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("voice")]
[Authorize]
public class VoiceController : AuthenticatedController
{
    private readonly IVoiceService _voice;
    private readonly IGuildService _guilds;

    public VoiceController(IVoiceService voice, IGuildService guilds)
    {
        _voice = voice;
        _guilds = guilds;
    }

    [HttpGet("channels/{channelId:guid}/participants")]
    public async Task<IActionResult> GetParticipants(Guid channelId)
    {
        if (!await _guilds.CanAccessChannelAsync(channelId, UserId))
            return Forbid();

        var participants = await _voice.GetChannelParticipantsAsync(channelId);
        return Ok(participants);
    }
}
