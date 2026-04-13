using Librecord.Application.Models.Results;

namespace Librecord.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string email, string username, string displayName, string password);
    Task<AuthResult> LoginAsync(string emailOrUsername, string password);
    Task<string?> TryRefreshTokenAsync(string refreshToken);

    Task<AuthResult> RefreshTokenAsync(string refreshToken);
    Task LogoutAllDevicesAsync(Guid userId);
    Task<AuthResult> MeAsync(Guid userId);

    // 2FA
    Task<TwoFactorSetupResult> SetupTwoFactorAsync(Guid userId);
    Task<TwoFactorEnableResult> EnableTwoFactorAsync(Guid userId, string code);
    Task<AuthResult> DisableTwoFactorAsync(Guid userId, string password);
    Task<AuthResult> VerifyTwoFactorLoginAsync(string sessionToken, string code);
    Task<AuthResult> VerifyTwoFactorRecoveryAsync(string sessionToken, string recoveryCode);
    Task<TwoFactorEnableResult> RegenerateRecoveryCodesAsync(Guid userId, string password);
}

public class TwoFactorSetupResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? SharedKey { get; set; }
    public string? AuthenticatorUri { get; set; }

    public static TwoFactorSetupResult Fail(string error) => new() { Error = error };
}

public class TwoFactorEnableResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public IEnumerable<string>? RecoveryCodes { get; set; }

    public static TwoFactorEnableResult Fail(string error) => new() { Error = error };
}
