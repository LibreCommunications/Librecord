using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Security;
using Microsoft.Extensions.Logging;

namespace Librecord.Application.Messaging;

public class MessageSearchService : IMessageSearchService
{
    private readonly IMessageSearchRepository _repo;
    private readonly IMessageEncryptionService _encryption;
    private readonly ILogger<MessageSearchService> _logger;

    public MessageSearchService(
        IMessageSearchRepository repo,
        IMessageEncryptionService encryption,
        ILogger<MessageSearchService> logger)
    {
        _repo = repo;
        _encryption = encryption;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SearchMessageResult>> SearchAsync(
        string query, Guid? channelId, Guid? guildId, int limit)
    {
        var messages = await _repo.SearchMessagesAsync(channelId, guildId, limit * 3);
        var term = query.ToLowerInvariant();
        var results = new List<SearchMessageResult>();

        foreach (var msg in messages)
        {
            if (msg.Content == null || msg.Content.Length == 0) continue;

            try
            {
                byte[] salt;
                string algorithm;

                if (msg.DmContext != null)
                {
                    salt = msg.DmContext.EncryptionSalt;
                    algorithm = msg.DmContext.EncryptionAlgorithm;
                }
                else if (msg.GuildContext != null)
                {
                    salt = msg.GuildContext.EncryptionSalt;
                    algorithm = msg.GuildContext.EncryptionAlgorithm;
                }
                else continue;

                var plaintext = _encryption.Decrypt(msg.Content, salt, algorithm);
                if (!plaintext.Contains(term, StringComparison.OrdinalIgnoreCase))
                    continue;

                results.Add(new SearchMessageResult(
                    msg.Id,
                    msg.DmContext?.ChannelId ?? msg.GuildContext?.ChannelId,
                    plaintext,
                    msg.CreatedAt,
                    new SearchMessageAuthor(msg.User.Id, msg.User.UserName, msg.User.DisplayName, msg.User.AvatarUrl)));

                if (results.Count >= limit) break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to decrypt message {MessageId} during search", msg.Id);
            }
        }

        return results;
    }
}
