using Microsoft.AspNetCore.Identity;

namespace Librecord.Domain.Identity;

public interface IAuthRepository
{
    Task<User?> GetUserByEmailAsync(string email);
    Task<User?> GetUserByUserNameAsync(string username);
    Task<bool> CheckPasswordAsync(User user, string password);
    Task<IdentityResult> CreateUserAsync(User user, string password);

    Task AddRefreshTokenAsync(RefreshToken token);
    Task<RefreshToken?> GetRefreshTokenAsync(string token);
    Task RevokeRefreshTokenAsync(RefreshToken token);
    Task RevokeAllUserTokensAsync(Guid userId);

    Task<User?> GetUserByIdAsync(Guid id);

    // 2FA / TOTP
    Task<string> GetOrCreateAuthenticatorKeyAsync(User user);
    Task<bool> VerifyTwoFactorTokenAsync(User user, string code);
    Task SetTwoFactorEnabledAsync(User user, bool enabled);
    Task<IEnumerable<string>> GenerateRecoveryCodesAsync(User user, int count);
    Task<bool> RedeemRecoveryCodeAsync(User user, string code);
    Task ResetAuthenticatorKeyAsync(User user);

    // Account recovery codes (password reset)
    Task AddAccountRecoveryCodesAsync(IEnumerable<AccountRecoveryCode> codes);
    Task<AccountRecoveryCode?> FindUnusedAccountRecoveryCodeAsync(Guid userId, string codeHash);
    Task DeleteAccountRecoveryCodesAsync(Guid userId);
    Task<int> CountUnusedAccountRecoveryCodesAsync(Guid userId);
    Task ResetPasswordAsync(User user, string newPassword);

    Task SaveChangesAsync();
}