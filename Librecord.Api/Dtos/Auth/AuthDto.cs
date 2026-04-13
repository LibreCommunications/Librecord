using Librecord.Application.Models.Results;

namespace Librecord.Api.Dtos.Auth;

public class AuthDto
{
    public bool Success { get; set; }
    public string? Error { get; set; }

    public Guid? UserId { get; set; }
    public string? Username { get; set; }
    public string? DisplayName { get; set; }
    public string? Email { get; set; }

    public bool? EmailVerified { get; set; }
    public bool? RequiresEmailVerification { get; set; }
    public bool? RequiresTwoFactor { get; set; }
    public string? TwoFactorSessionToken { get; set; }

    public static AuthDto From(AuthResult result)
    {
        return new AuthDto
        {
            Success = result.Success,
            Error = result.Error,
            UserId = result.UserId,
            Username = result.Username,
            DisplayName = result.DisplayName,
            Email = result.Email,
            EmailVerified = result.EmailVerified,
            RequiresEmailVerification = result.RequiresEmailVerification ? true : null,
            RequiresTwoFactor = result.RequiresTwoFactor ? true : null,
            TwoFactorSessionToken = result.TwoFactorSessionToken
        };
    }
}