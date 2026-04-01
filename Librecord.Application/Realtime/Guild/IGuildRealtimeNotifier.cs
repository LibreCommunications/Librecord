namespace Librecord.Application.Realtime.Guild;

public interface IGuildRealtimeNotifier
{
    Task NotifyAsync(GuildMessageEvent evt);
    Task NotifyMemberAddedAsync(GuildMemberAdded evt);
    Task NotifyMemberRemovedAsync(GuildMemberRemoved evt);
    Task NotifyGuildUpdatedAsync(GuildUpdated evt);
    Task NotifyGuildDeletedAsync(GuildDeleted evt);
    Task NotifyThreadMessageCreatedAsync(ThreadMessageCreated evt);
}
