namespace Librecord.Application.Realtime.Voice;

public interface IVoiceRealtimeNotifier
{
    Task NotifyAsync(VoiceEvent evt);
}
