namespace Librecord.Domain.Voice;

public interface ILiveKitTokenService
{
    string GenerateToken(Guid userId, string displayName, Guid channelId);
}
