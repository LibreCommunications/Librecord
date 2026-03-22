using Librecord.Application.Guilds;
using Librecord.Application.Interfaces;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Application.Services;
using Librecord.Application.Social;
using Librecord.Application.Users;
using Librecord.Application.Voice;
using Microsoft.Extensions.DependencyInjection;

namespace Librecord.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Singletons
        services.AddSingleton<IPermissionRegistry, PermissionRegistry>();
        services.AddSingleton<IConnectionTracker, ConnectionTracker>();

        // Register all application services here
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IFriendshipService, FriendshipService>();
        services.AddScoped<IGuildService, GuildService>();
        services.AddScoped<IGuildInviteService, GuildInviteService>();
        services.AddScoped<IChannelService, ChannelService>();
        services.AddScoped<IGuildChannelMessageService, GuildChannelMessageService>();
        services.AddScoped<IDirectMessageChannelService, DirectMessageChannelService>();
        services.AddScoped<IDirectMessageService, DirectMessageService>();
        services.AddScoped<IPresenceService, PresenceService>();
        services.AddScoped<IReactionService, ReactionService>();
        services.AddScoped<IVoiceService, VoiceService>();
        services.AddScoped<IBlockService, BlockService>();
        services.AddScoped<IGuildMemberService, GuildMemberService>();
        services.AddScoped<IGuildSettingsService, GuildSettingsService>();

        // Add more application services later:
        // services.AddScoped<IGuildService, GuildService>();
        // services.AddScoped<IMessageService, MessageService>();

        return services;
    }
}