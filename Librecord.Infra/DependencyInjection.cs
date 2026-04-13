using Librecord.Domain;
using Librecord.Domain.Guilds;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Messaging.Guild;
using Librecord.Domain.Security;
using Librecord.Domain.Social;
using Librecord.Domain.Storage;
using Librecord.Domain.Voice;
using Librecord.Infra.Database;
using Librecord.Infra.Repositories;
using Librecord.Infra.Security;
using Librecord.Infra.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Librecord.Infra;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddOptions<JwtOptions>()
            .Bind(config.GetSection("Jwt"))
            .ValidateDataAnnotations();

        services.AddMemoryCache();

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IFriendshipRepository, FriendshipRepository>();
        services.AddScoped<IBlockRepository, BlockRepository>();

        services.AddScoped<IGuildRepository, GuildRepository>();
        services.AddScoped<IGuildInviteRepository, GuildInviteRepository>();
        services.AddScoped<IChannelRepository, ChannelRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();

        services.AddScoped<IGuildMessageRepository, GuildMessageRepository>();

        services.AddScoped<IDirectMessageChannelRepository, DirectMessageChannelRepository>();
        services.AddScoped<IDirectMessageRepository, DirectMessageRepository>();
        services.AddScoped<IPresenceRepository, PresenceRepository>();
        services.AddScoped<IReactionRepository, ReactionRepository>();
        services.AddScoped<IReadStateRepository, ReadStateRepository>();
        services.AddScoped<IVoiceStateRepository, VoiceStateRepository>();
        services.AddScoped<IPinRepository, PinRepository>();
        services.AddScoped<IMessageSearchRepository, MessageSearchRepository>();
        services.AddScoped<IAttachmentRepository, AttachmentRepository>();
        services.AddScoped<IAttachmentAccessRepository, AttachmentAccessRepository>();
        services.AddScoped<IThreadRepository, ThreadRepository>();

        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddSingleton<IMessageEncryptionService>(
            new AesGcmMessageEncryptionService(
                Convert.FromBase64String(
                    config["Security:MessageEncryptionKey"]!
                )
            )
        );

        services.AddOptions<LiveKitOptions>()
            .Bind(config.GetSection("LiveKit"))
            .ValidateDataAnnotations();

        services.AddSingleton<ILiveKitTokenService, LiveKitTokenService>();

        services.Configure<AttachmentStorageOptions>(
            config.GetSection("Minio"));

        services.AddSingleton<IAttachmentStorageService, MinioAttachmentStorage>();

        return services;
    }
}
