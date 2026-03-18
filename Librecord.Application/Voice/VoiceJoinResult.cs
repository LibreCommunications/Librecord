namespace Librecord.Application.Voice;

public class VoiceJoinResult
{
    public string Token { get; init; } = null!;
    public string WsUrl { get; init; } = null!;
    public List<VoiceParticipantDto> Participants { get; init; } = [];
}
