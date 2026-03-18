using Librecord.Application.Models;
using Librecord.Application.Models.Results;

namespace Librecord.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string email, string username, string displayName, string password);
    Task<AuthResult> LoginAsync(string emailOrUsername, string password);
    Task<string?> TryRefreshTokenAsync(string refreshToken);

    Task<AuthResult> RefreshTokenAsync(string refreshToken);
    Task<AuthResult> MeAsync(Guid userId);
}