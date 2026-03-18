namespace Librecord.Application.Realtime.DMs;

public interface IDmRealtimeNotifier
{
    Task NotifyAsync(DmMessageEvent evt);
}