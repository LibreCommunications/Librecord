using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Guild;
using Librecord.Domain.Security;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public sealed class GuildMessageRepository : IGuildMessageRepository
{
    private readonly LibrecordContext _db;
    private readonly IMessageEncryptionService _encryption;

    public GuildMessageRepository(
        LibrecordContext db,
        IMessageEncryptionService encryption)
    {
        _db = db;
        _encryption = encryption;
    }


    public async Task<Message?> GetMessageAsync(Guid messageId)
    {
        var entity = await LoadMessage(messageId);
        return entity == null ? null : DecryptToDetached(entity);
    }

    public async Task<List<Message>> GetChannelMessagesAsync(
        Guid channelId,
        int limit = 50,
        Guid? beforeMessageId = null)
    {
        IQueryable<Message> query = _db.Messages
            .Where(m =>
                m.GuildContext != null &&
                m.GuildContext.ChannelId == channelId);

        if (beforeMessageId.HasValue)
        {
            var beforeCreatedAt = await _db.Messages
                .Where(m => m.Id == beforeMessageId.Value)
                .Select(m => m.CreatedAt)
                .FirstAsync();

            query = query.Where(m => m.CreatedAt < beforeCreatedAt);
        }

        var entities = await query
            .AsNoTracking()
            .AsSplitQuery()
            .OrderByDescending(m => m.CreatedAt)
            .Include(m => m.User)
            .Include(m => m.GuildContext).ThenInclude(gc => gc!.Channel)
            .Include(m => m.ReplyToMessage).ThenInclude(r => r!.User)
            .Include(m => m.ReplyToMessage).ThenInclude(r => r!.GuildContext)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
            .ThenInclude(r => r.User)
            .Include(m => m.Edits)
            .ThenInclude(e => e.Editor)
            .Take(limit)
            .ToListAsync();

        return entities
            .Select(DecryptToDetached)
            .ToList();
    }



    public async Task AddMessageAsync(Message message, Guid channelId)
    {
        var encrypted = _encryption.Encrypt(message.ContentText);

        message.Content = encrypted.Ciphertext;

        await _db.Messages.AddAsync(message);

        await _db.GuildChannelMessages.AddAsync(new GuildChannelMessage
        {
            MessageId = message.Id,
            ChannelId = channelId,
            EncryptionSalt = encrypted.Salt,
            EncryptionAlgorithm = encrypted.Algorithm
        });
    }


    public Task AddMessageEditAsync(MessageEdit edit)
    {
        _db.MessageEdits.Add(edit);
        return Task.CompletedTask;
    }

    public Task UpdateMessageAsync(Message message)
    {
        _db.Messages.Update(message);
        return Task.CompletedTask;
    }

    public async Task DeleteMessageAsync(Guid messageId)
    {
        var entity = await _db.Messages.FindAsync(messageId);
        if (entity != null)
            _db.Messages.Remove(entity);
    }

    public Task SaveChangesAsync()
        => _db.SaveChangesAsync();


    private async Task<Message?> LoadMessage(Guid id)
        => await _db.Messages
            .Include(m => m.User)
            .Include(m => m.GuildContext).ThenInclude(gc => gc!.Channel)
            .Include(m => m.ReplyToMessage).ThenInclude(r => r!.User)
            .Include(m => m.ReplyToMessage).ThenInclude(r => r!.GuildContext)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions).ThenInclude(r => r.User)
            .Include(m => m.Edits).ThenInclude(e => e.Editor)
            .FirstOrDefaultAsync(m => m.Id == id);

    private Message DecryptToDetached(Message entity)
    {
        var gc = entity.GuildContext
                 ?? throw new InvalidOperationException("GuildContext missing");

        entity.ContentText = _encryption.Decrypt(
            entity.Content,
            gc.EncryptionSalt,
            gc.EncryptionAlgorithm);

        if (entity.ReplyToMessage?.GuildContext != null)
        {
            var rc = entity.ReplyToMessage.GuildContext;
            entity.ReplyToMessage.ContentText = _encryption.Decrypt(
                entity.ReplyToMessage.Content,
                rc.EncryptionSalt,
                rc.EncryptionAlgorithm);
        }

        return entity;
    }

}