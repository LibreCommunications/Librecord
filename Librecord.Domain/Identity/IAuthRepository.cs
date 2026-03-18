using Microsoft.AspNetCore.Identity;

namespace Librecord.Domain.Identity;

public interface IAuthRepository
{
    Task<User?> GetUserByEmailAsync(string email);
    Task<User?> GetUserByUserNameAsync(string username);
    Task<bool> CheckPasswordAsync(User user, string password);
    Task<IdentityResult> CreateUserAsync(User user, string password);

    // Refresh tokens
    Task AddRefreshTokenAsync(RefreshToken token);
    Task<RefreshToken?> GetRefreshTokenAsync(string token);
    Task RevokeRefreshTokenAsync(RefreshToken token);

    Task<User?> GetUserByIdAsync(Guid id);

    Task SaveChangesAsync();
}