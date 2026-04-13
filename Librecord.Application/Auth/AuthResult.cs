using Librecord.Domain.Identity;

namespace Librecord.Application.Models.Results;

public class AuthResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }

    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }

    public Guid? UserId { get; set; }
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? DisplayName { get; set; }

    public bool EmailVerified { get; set; }
    public bool RequiresEmailVerification { get; set; }

    /// <summary>Login requires a 2FA code before tokens are issued.</summary>
    public bool RequiresTwoFactor { get; set; }

    /// <summary>Short-lived opaque token proving password was validated (used for 2FA step 2).</summary>
    public string? TwoFactorSessionToken { get; set; }

    public static AuthResult FromUser(User user)
    {
        return new AuthResult
        {
            Success = true,
            UserId = user.Id,
            Email = user.Email,
            Username = user.UserName,
            DisplayName = user.DisplayName,
            EmailVerified = user.EmailConfirmed
        };
    }

    public static AuthResult Fail(string error)
    {
        return new AuthResult { Success = false, Error = error };
    }

    public static AuthResult SuccessResult(User user, string accessToken, string refreshToken)
    {
        return new AuthResult
        {
            Success = true,
            UserId = user.Id,
            Username = user.UserName,
            Email = user.Email,
            DisplayName = user.DisplayName,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            EmailVerified = user.EmailConfirmed
        };
    }

    public static AuthResult TwoFactorRequired(User user, string sessionToken)
    {
        return new AuthResult
        {
            Success = true,
            RequiresTwoFactor = true,
            TwoFactorSessionToken = sessionToken,
            UserId = user.Id,
            Username = user.UserName
        };
    }
}
