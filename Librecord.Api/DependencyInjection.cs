using System.Text.Json;
using Librecord.Api.Hubs;
using Librecord.Api.RealtimeNotifiers;
using Librecord.Application.Realtime.DMs;
using Librecord.Application.Realtime.Guild;
using Librecord.Application.Realtime.Voice;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Librecord.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration configuration)
    {
        // ----------------------------
        // MVC / Controllers
        // ----------------------------
        services.AddControllers()
            .AddJsonOptions(o =>
            {
                o.JsonSerializerOptions.PropertyNamingPolicy =
                    JsonNamingPolicy.CamelCase;
            });

        // ----------------------------
        // SignalR
        // ----------------------------
        services.AddSignalR();

        // ----------------------------
        // Realtime adapters
        // ----------------------------
        services.AddScoped<IDmRealtimeNotifier, SignalRDmRealtimeNotifier>();
        services.AddScoped<IGuildRealtimeNotifier, SignalRGuildRealtimeNotifier>();
        services.AddScoped<IVoiceRealtimeNotifier, SignalRVoiceRealtimeNotifier>();

        // ----------------------------
        // CORS (frontend)
        // ----------------------------
        var corsOrigins = configuration.GetSection("Cors:Origins").Get<string[]>()
                          ?? ["https://localhost:5173"];

        services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
            {
                policy
                    .WithOrigins(corsOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }
}