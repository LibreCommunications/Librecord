namespace Librecord.Domain.Voice;

public interface IVoiceStateRepository
{
    Task<VoiceState?> GetByUserIdAsync(Guid userId);
    Task<List<VoiceState>> GetAllAsync();
    Task<List<VoiceState>> GetByChannelIdAsync(Guid channelId);
    Task AddAsync(VoiceState voiceState);
    Task UpdateAsync(VoiceState voiceState);
    Task RemoveAsync(Guid userId);
    Task RemoveAllAsync();
    Task SaveChangesAsync();
}
