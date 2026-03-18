using Librecord.Domain.Identity;

namespace Librecord.Application.Models.Results;

public class AuthResult
{
    public bool Success { get; private set; }
    public string? Error { get; private set; }

    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }

    public Guid? UserId { get; private set; }
    public string? Username { get; private set; }
    public string? Email { get; private set; }
    public string? DisplayName { get; private set; }

    public static AuthResult FromUser(User user)
    {
        return new AuthResult
        {
            Success = true,
            UserId = user.Id,
            Email = user.Email,
            Username = user.UserName,
            DisplayName = user.DisplayName
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
            RefreshToken = refreshToken
        };
    }
}