using Librecord.Domain.Voice;
using Livekit.Server.Sdk.Dotnet;
using Microsoft.Extensions.Options;

namespace Librecord.Infra.Services;

public class LiveKitTokenService : ILiveKitTokenService
{
    private readonly LiveKitOptions _options;

    public LiveKitTokenService(IOptions<LiveKitOptions> options)
    {
        _options = options.Value;
    }

    public string GenerateToken(Guid userId, string displayName, Guid channelId)
    {
        var token = new AccessToken(_options.ApiKey, _options.ApiSecret)
            .WithIdentity(userId.ToString())
            .WithName(displayName)
            .WithGrants(new VideoGrants
            {
                RoomJoin = true,
                Room = channelId.ToString(),
                CanPublish = true,
                CanSubscribe = true,
                CanPublishData = true
            })
            .WithTtl(TimeSpan.FromHours(6));

        return token.ToJwt();
    }
}
