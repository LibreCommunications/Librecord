namespace Librecord.Application.Realtime.Guild;

public interface IGuildRealtimeNotifier
{
    Task NotifyAsync(GuildMessageEvent evt);
}
