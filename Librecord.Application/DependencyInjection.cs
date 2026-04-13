using Librecord.Application.Guilds;
using Librecord.Application.Interfaces;
using Librecord.Application.Messaging;
using Librecord.Application.Permissions;
using Librecord.Application.Services;
using Librecord.Application.Social;
using Librecord.Application.Users;
using Librecord.Application.Voice;
using Librecord.Domain.Identity;
using Librecord.Domain.Security;
using Microsoft.Extensions.DependencyInjection;

namespace Librecord.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, bool isDevelopment = false)
    {
        services.AddSingleton<IPermissionRegistry, PermissionRegistry>();
        services.AddSingleton<IConnectionTracker, ConnectionTracker>();

        services.AddScoped<IAuthService>(sp => new AuthService(
            sp.GetRequiredService<IAuthRepository>(),
            sp.GetRequiredService<IJwtTokenGenerator>(),
            sp.GetRequiredService<IEmailSender>(),
            isDevelopment));
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
        services.AddScoped<IPinService, PinService>();
        services.AddScoped<IMessageSearchService, MessageSearchService>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        services.AddScoped<IThreadService, ThreadService>();

        return services;
    }
}