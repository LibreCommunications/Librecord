using Librecord.Domain.Identity;

namespace Librecord.Domain.Security;

public interface IJwtTokenGenerator
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
}