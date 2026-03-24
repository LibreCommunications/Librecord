namespace Librecord.Domain.Messaging.Common;

public interface IMessageSearchRepository
{
    Task<List<Message>> SearchMessagesAsync(Guid? channelId, Guid? guildId, int fetchLimit);
}
