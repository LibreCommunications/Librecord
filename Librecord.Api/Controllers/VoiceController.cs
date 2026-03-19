using System.Security.Claims;
using Librecord.Application.Voice;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("voice")]
[Authorize]
public class VoiceController : ControllerBase
{
    private readonly IVoiceService _voice;

    public VoiceController(IVoiceService voice)
    {
        _voice = voice;
    }

    [HttpGet("channels/{channelId:guid}/participants")]
    public async Task<IActionResult> GetParticipants(Guid channelId)
    {
        var participants = await _voice.GetChannelParticipantsAsync(channelId);
        return Ok(participants);
    }
}
