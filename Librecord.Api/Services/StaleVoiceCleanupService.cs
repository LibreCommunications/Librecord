using Librecord.Application.Realtime.Voice;
using Librecord.Application.Users;
using Librecord.Domain.Voice;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Librecord.Api.Services;

/// <summary>
/// Periodically scans for orphaned voice states and removes them.
///
/// Voice states can become orphaned when:
///   - The server restarts and clients don't reconnect
///   - A DB race condition leaves a stale row
///   - SignalR's OnDisconnectedAsync fails to fire (rare)
///
/// The service checks every 60 seconds. A voice state is considered stale
/// if the user has no active SignalR connections (per ConnectionTracker)
/// and their JoinedAt timestamp is older than the grace period (60s),
/// allowing time for brief reconnects (page refresh, network blip).
/// </summary>
public class StaleVoiceCleanupService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan GracePeriod = TimeSpan.FromSeconds(60);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConnectionTracker _connections;
    private readonly ILogger<StaleVoiceCleanupService> _logger;

    public StaleVoiceCleanupService(
        IServiceScopeFactory scopeFactory,
        IConnectionTracker connections,
        ILogger<StaleVoiceCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _connections = connections;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait a bit before the first sweep to let the app finish starting up.
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Stale voice cleanup sweep failed");
            }

            await Task.Delay(SweepInterval, stoppingToken);
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var repo = scope.ServiceProvider.GetRequiredService<IVoiceStateRepository>();
        var notifier = scope.ServiceProvider.GetRequiredService<IVoiceRealtimeNotifier>();

        var allStates = await repo.GetAllAsync();
        if (allStates.Count == 0) return;

        var now = DateTime.UtcNow;
        var removed = 0;

        foreach (var state in allStates)
        {
            ct.ThrowIfCancellationRequested();

            // Skip if user is still online (has active SignalR connections).
            if (_connections.IsOnline(state.UserId)) continue;

            // Skip if within grace period (user might be reconnecting).
            if (now - state.JoinedAt < GracePeriod) continue;

            try
            {
                await repo.RemoveAsync(state.UserId);
                await repo.SaveChangesAsync();

                await notifier.NotifyAsync(new VoiceUserLeft
                {
                    ChannelId = state.ChannelId,
                    GuildId = state.GuildId,
                    UserId = state.UserId,
                });

                removed++;
            }
            catch (Exception ex)
            {
                // Row may have been removed concurrently — not an error.
                _logger.LogDebug(ex,
                    "Failed to remove stale voice state for user {UserId}", state.UserId);
            }
        }

        if (removed > 0)
        {
            _logger.LogInformation(
                "Stale voice cleanup: removed {Count} orphaned voice state(s)", removed);
        }
    }
}
