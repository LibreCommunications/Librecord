using Librecord.Domain.Messaging.Common;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class PinRepository : IPinRepository
{
    private readonly LibrecordContext _db;

    public PinRepository(LibrecordContext db) => _db = db;

    public Task<PinnedMessage?> GetPinAsync(Guid channelId, Guid messageId)
        => _db.PinnedMessages.FirstOrDefaultAsync(p => p.ChannelId == channelId && p.MessageId == messageId);

    public Task<List<PinnedMessage>> GetPinsForChannelAsync(Guid channelId)
        => _db.PinnedMessages
            .Where(p => p.ChannelId == channelId)
            .Include(p => p.Message).ThenInclude(m => m.User)
            .Include(p => p.Message).ThenInclude(m => m.DmContext)
            .Include(p => p.Message).ThenInclude(m => m.GuildContext)
            .Include(p => p.PinnedBy)
            .OrderByDescending(p => p.PinnedAt)
            .ToListAsync();

    public Task AddPinAsync(PinnedMessage pin)
    {
        _db.PinnedMessages.Add(pin);
        return Task.CompletedTask;
    }

    public Task RemovePinAsync(PinnedMessage pin)
    {
        _db.PinnedMessages.Remove(pin);
        return Task.CompletedTask;
    }

    public async Task<bool> IsMessageInChannelAsync(Guid channelId, Guid messageId)
        => await _db.DmChannelMessages.AnyAsync(m => m.ChannelId == channelId && m.MessageId == messageId)
        || await _db.GuildChannelMessages.AnyAsync(m => m.ChannelId == channelId && m.MessageId == messageId);

    public async Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId)
        => await _db.DmChannelMembers.AnyAsync(m => m.ChannelId == channelId && m.UserId == userId)
        || await _db.GuildChannels.AnyAsync(c => c.Id == channelId && c.Guild.Members.Any(m => m.UserId == userId));

    public Task SaveChangesAsync() => _db.SaveChangesAsync();
}
