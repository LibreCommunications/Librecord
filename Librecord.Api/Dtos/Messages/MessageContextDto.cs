using Librecord.Domain.Messaging.Common;

namespace Librecord.Contracts.Messages;

public sealed class MessageContextDto
{
    public required string Type { get; init; } // "guild" | "dm"

    public Guid ChannelId { get; init; }

    // Guild-only
    public Guid? GuildId { get; init; }

    public static MessageContextDto From(Message message)
    {
        if (message.GuildContext != null)
        {
            return new MessageContextDto
            {
                Type = "guild",
                ChannelId = message.GuildContext.ChannelId,
                GuildId = message.GuildContext.Channel.GuildId
            };
        }

        if (message.DmContext != null)
        {
            return new MessageContextDto
            {
                Type = "dm",
                ChannelId = message.DmContext.ChannelId,
                GuildId = null
            };
        }

        throw new InvalidOperationException(
            "Message has no DM or Guild context.");
    }
}