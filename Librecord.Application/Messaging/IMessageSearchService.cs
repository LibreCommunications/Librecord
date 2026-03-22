namespace Librecord.Application.Messaging;

public interface IMessageSearchService
{
    Task<IReadOnlyList<SearchMessageResult>> SearchAsync(string query, Guid? channelId, Guid? guildId, int limit);
}

public record SearchMessageResult(
    Guid Id, Guid? ChannelId, string Content, DateTime CreatedAt,
    SearchMessageAuthor Author);

public record SearchMessageAuthor(Guid Id, string? Username, string DisplayName, string? AvatarUrl);
