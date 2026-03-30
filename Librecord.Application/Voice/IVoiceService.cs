namespace Librecord.Application.Voice;

public interface IVoiceService
{
    Task<VoiceJoinResult> JoinVoiceChannelAsync(Guid channelId, Guid userId);
    Task<VoiceJoinResult> JoinDmVoiceCallAsync(Guid dmChannelId, Guid userId);
    Task LeaveVoiceChannelAsync(Guid userId);
    Task UpdateVoiceStateAsync(Guid userId, VoiceStateUpdateDto update);
    Task<List<VoiceParticipantDto>> GetChannelParticipantsAsync(Guid channelId);
    Task<Domain.Voice.VoiceState?> GetVoiceStateAsync(Guid userId);
}
