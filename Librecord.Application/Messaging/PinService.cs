using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Security;

namespace Librecord.Application.Messaging;

public class PinService : IPinService
{
    private readonly IPinRepository _pins;
    private readonly IMessageEncryptionService _encryption;

    public PinService(IPinRepository pins, IMessageEncryptionService encryption)
    {
        _pins = pins;
        _encryption = encryption;
    }

    public Task<bool> IsChannelMemberAsync(Guid channelId, Guid userId)
        => _pins.IsChannelMemberAsync(channelId, userId);

    public async Task<bool> PinMessageAsync(Guid channelId, Guid messageId, Guid userId)
    {
        var existing = await _pins.GetPinAsync(channelId, messageId);
        if (existing != null) return true;

        if (!await _pins.IsMessageInChannelAsync(channelId, messageId))
            return false;

        await _pins.AddPinAsync(new PinnedMessage
        {
            ChannelId = channelId,
            MessageId = messageId,
            PinnedById = userId,
            PinnedAt = DateTime.UtcNow
        });

        await _pins.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UnpinMessageAsync(Guid channelId, Guid messageId)
    {
        var pin = await _pins.GetPinAsync(channelId, messageId);
        if (pin == null) return false;

        await _pins.RemovePinAsync(pin);
        await _pins.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<PinnedMessageResult>> GetPinnedMessagesAsync(Guid channelId)
    {
        var pins = await _pins.GetPinsForChannelAsync(channelId);

        return pins.Select(p =>
        {
            string? content = null;
            try
            {
                if (p.Message.DmContext != null)
                    content = _encryption.Decrypt(p.Message.Content, p.Message.DmContext.EncryptionSalt, p.Message.DmContext.EncryptionAlgorithm);
                else if (p.Message.GuildContext != null)
                    content = _encryption.Decrypt(p.Message.Content, p.Message.GuildContext.EncryptionSalt, p.Message.GuildContext.EncryptionAlgorithm);
            }
            catch { }

            return new PinnedMessageResult(
                p.MessageId, p.ChannelId, content, p.Message.CreatedAt,
                new PinnedMessageAuthor(p.Message.User.Id, p.Message.User.UserName, p.Message.User.DisplayName),
                new PinnedMessageAuthor(p.PinnedBy.Id, null, p.PinnedBy.DisplayName),
                p.PinnedAt);
        }).ToList();
    }
}
