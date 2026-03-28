using Librecord.Domain.Messaging.Common;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class AttachmentRepository : IAttachmentRepository
{
    private readonly LibrecordContext _db;

    public AttachmentRepository(LibrecordContext db) => _db = db;

    public Task AddAttachmentAsync(MessageAttachment attachment)
    {
        _db.MessageAttachments.Add(attachment);
        return Task.CompletedTask;
    }

    public Task<List<string>> GetUrlsByChannelAsync(Guid channelId)
    {
        return _db.MessageAttachments
            .Where(a =>
                a.Message.GuildContext != null && a.Message.GuildContext.ChannelId == channelId)
            .Select(a => a.Url)
            .ToListAsync();
    }

    public Task<List<string>> GetUrlsByGuildAsync(Guid guildId)
    {
        return _db.MessageAttachments
            .Where(a =>
                a.Message.GuildContext != null && a.Message.GuildContext.Channel.GuildId == guildId)
            .Select(a => a.Url)
            .ToListAsync();
    }

    public Task SaveChangesAsync() => _db.SaveChangesAsync();
}
