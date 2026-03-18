using Librecord.Application.Interfaces;
using Librecord.Application.Models;
using Librecord.Application.Models.Results;
using Librecord.Domain.Identity;
using Librecord.Domain.Security;

namespace Librecord.Application.Services;

public class AuthService : IAuthService
{
    private readonly IJwtTokenGenerator _jwt;
    private readonly IAuthRepository _repo;

    public AuthService(IAuthRepository repo, IJwtTokenGenerator jwt)
    {
        _repo = repo;
        _jwt = jwt;
    }

    public async Task<AuthResult> RegisterAsync(string email, string username, string displayName, string password)
    {
        // Email exists?
        if (await _repo.GetUserByEmailAsync(email) != null)
            return AuthResult.Fail("Email already in use.");

        // Username exists?
        if (await _repo.GetUserByUserNameAsync(username) != null)
            return AuthResult.Fail("Username already in use.");

        // Create new user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            UserName = username,
            DisplayName = displayName
        };

        var result = await _repo.CreateUserAsync(user, password);

        if (!result.Succeeded)
            return AuthResult.Fail(string.Join(", ", result.Errors.Select(e => e.Description)));


        var accessToken = _jwt.GenerateAccessToken(user);
        var refreshToken = _jwt.GenerateRefreshToken();

        await _repo.AddRefreshTokenAsync(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(14)
        });

        await _repo.SaveChangesAsync();

        return AuthResult.SuccessResult(user, accessToken, refreshToken);
    }

    public async Task<string?> TryRefreshTokenAsync(string refreshToken)
    {
        var result = await RefreshTokenAsync(refreshToken);

        if (!result.Success)
            return null;

        return result.AccessToken;
    }


    public async Task<AuthResult> LoginAsync(string emailOrUsername, string password)
    {
        var user =
            emailOrUsername.Contains("@")
                ? await _repo.GetUserByEmailAsync(emailOrUsername)
                : await _repo.GetUserByUserNameAsync(emailOrUsername);

        if (user == null)
            return AuthResult.Fail("Invalid credentials.");

        if (!await _repo.CheckPasswordAsync(user, password))
            return AuthResult.Fail("Invalid credentials.");


        var access = _jwt.GenerateAccessToken(user);
        var refresh = _jwt.GenerateRefreshToken();

        await _repo.AddRefreshTokenAsync(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refresh,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(14)
        });

        await _repo.SaveChangesAsync();

        return AuthResult.SuccessResult(user, access, refresh);
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken)
    {
        var existing = await _repo.GetRefreshTokenAsync(refreshToken);

        if (existing == null || existing.IsRevoked || existing.IsExpired)
            return AuthResult.Fail("Invalid refresh token.");

        var user = await _repo.GetUserByIdAsync(existing.UserId);
        if (user == null)
            return AuthResult.Fail("User not found.");

        // Generate new tokens
        var newAccess = _jwt.GenerateAccessToken(user);
        var newRefresh = _jwt.GenerateRefreshToken();

        // Revoke old refresh token
        existing.IsRevoked = true;

        // Save new refresh token
        await _repo.AddRefreshTokenAsync(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = newRefresh,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(14)
        });

        await _repo.SaveChangesAsync();

        return AuthResult.SuccessResult(user, newAccess, newRefresh);
    }

    public async Task<AuthResult> MeAsync(Guid userId)
    {
        var user = await _repo.GetUserByIdAsync(userId);

        if (user == null)
            return AuthResult.Fail("User not found.");

        return AuthResult.FromUser(user);
    }
}