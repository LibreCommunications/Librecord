using Librecord.Domain.Messaging.Common;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class AttachmentAccessRepository : IAttachmentAccessRepository
{
    private readonly LibrecordContext _db;

    public AttachmentAccessRepository(LibrecordContext db) => _db = db;

    public async Task<bool> CanUserAccessMessageAsync(Guid messageId, Guid userId)
    {
        // Check DM channel membership
        var dmAccess = await _db.DmChannelMessages
            .Where(dcm => dcm.MessageId == messageId)
            .Select(dcm => dcm.Channel.Members.Any(m => m.UserId == userId))
            .FirstOrDefaultAsync();

        if (dmAccess) return true;

        // Check guild channel membership
        var guildChannelId = await _db.GuildChannelMessages
            .Where(gcm => gcm.MessageId == messageId)
            .Select(gcm => (Guid?)gcm.ChannelId)
            .FirstOrDefaultAsync();

        if (guildChannelId == null) return false;

        var guildId = await _db.GuildChannels
            .Where(gc => gc.Id == guildChannelId)
            .Select(gc => gc.GuildId)
            .FirstOrDefaultAsync();

        return await _db.GuildMembers
            .AnyAsync(gm => gm.GuildId == guildId && gm.UserId == userId);
    }
}
