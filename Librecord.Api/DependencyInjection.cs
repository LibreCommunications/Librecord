using System.Text.Json;
using Librecord.Api.Hubs;
using Librecord.Api.RealtimeNotifiers;
using Librecord.Application.Realtime.DMs;
using Librecord.Application.Realtime.Guild;
using Librecord.Application.Realtime.Social;
using Librecord.Application.Realtime.Voice;
using Librecord.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Librecord.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddControllers()
            .AddJsonOptions(o =>
            {
                o.JsonSerializerOptions.PropertyNamingPolicy =
                    JsonNamingPolicy.CamelCase;
            });

        // Keepalive every 10s to prevent Cloudflare from killing idle WebSockets (100s timeout)
        services.AddSignalR(options =>
        {
            options.KeepAliveInterval = TimeSpan.FromSeconds(10);
            options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
        });

        services.AddScoped<IDmRealtimeNotifier, SignalRDmRealtimeNotifier>();
        services.AddScoped<IGuildRealtimeNotifier, SignalRGuildRealtimeNotifier>();
        services.AddScoped<IVoiceRealtimeNotifier, SignalRVoiceRealtimeNotifier>();
        services.AddScoped<IFriendshipRealtimeNotifier, SignalRFriendshipNotifier>();

        services.AddHostedService<StaleVoiceCleanupService>();

        var corsOrigins = configuration.GetSection("Cors:Origins").Get<string[]>()
                          ?? ["https://localhost:5173"];

        services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
            {
                policy
                    .WithOrigins(corsOrigins)
                    .WithMethods("GET", "POST", "PUT", "DELETE")
                    .WithHeaders("Content-Type", "X-Requested-With", "X-SignalR-User-Agent")
                    .AllowCredentials();
            });
        });

        return services;
    }
}