using Librecord.Domain.Voice;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class VoiceStateRepository : IVoiceStateRepository
{
    private readonly LibrecordContext _db;

    public VoiceStateRepository(LibrecordContext db)
    {
        _db = db;
    }

    public Task<VoiceState?> GetByUserIdAsync(Guid userId)
    {
        return _db.VoiceStates.FirstOrDefaultAsync(v => v.UserId == userId);
    }

    public Task<List<VoiceState>> GetAllAsync()
    {
        return _db.VoiceStates.AsNoTracking().ToListAsync();
    }

    public Task<List<VoiceState>> GetByChannelIdAsync(Guid channelId)
    {
        return _db.VoiceStates
            .Where(v => v.ChannelId == channelId)
            .OrderBy(v => v.JoinedAt)
            .AsNoTracking()
            .ToListAsync();
    }

    public Task AddAsync(VoiceState voiceState)
    {
        _db.VoiceStates.Add(voiceState);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(VoiceState voiceState)
    {
        _db.VoiceStates.Update(voiceState);
        return Task.CompletedTask;
    }

    public async Task RemoveAsync(Guid userId)
    {
        var state = await _db.VoiceStates.FirstOrDefaultAsync(v => v.UserId == userId);
        if (state is not null)
            _db.VoiceStates.Remove(state);
    }

    public Task RemoveAllAsync()
    {
        return _db.VoiceStates.ExecuteDeleteAsync();
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}
