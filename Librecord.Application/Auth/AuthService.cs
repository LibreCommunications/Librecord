using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Librecord.Application.Interfaces;
using Librecord.Application.Models.Results;
using Librecord.Domain.Identity;
using Librecord.Domain.Security;

namespace Librecord.Application.Services;

public class AuthService : IAuthService
{
    private readonly IJwtTokenGenerator _jwt;
    private readonly IAuthRepository _repo;

    // In-memory store for 2FA session tokens (password-validated, awaiting TOTP).
    // Entries expire after 5 minutes.
    private static readonly ConcurrentDictionary<string, TwoFactorSession> TwoFactorSessions = new();

    public AuthService(IAuthRepository repo, IJwtTokenGenerator jwt)
    {
        _repo = repo;
        _jwt = jwt;
    }

    public async Task<AuthResult> RegisterAsync(string email, string username, string displayName, string password)
    {
        if (await _repo.GetUserByEmailAsync(email) != null)
            return AuthResult.Fail("Email already in use.");

        if (await _repo.GetUserByUserNameAsync(username) != null)
            return AuthResult.Fail("Username already in use.");

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

        // Generate account recovery codes
        var (plainCodes, hashedCodes) = GenerateAccountRecoveryCodes(user.Id);
        await _repo.AddAccountRecoveryCodesAsync(hashedCodes);

        await _repo.SaveChangesAsync();

        var authResult = AuthResult.SuccessResult(user, accessToken, refreshToken);
        authResult.AccountRecoveryCodes = plainCodes;
        return authResult;
    }

    public async Task<AuthResult> LoginAsync(string emailOrUsername, string password)
    {
        var user =
            emailOrUsername.Contains('@')
                ? await _repo.GetUserByEmailAsync(emailOrUsername)
                : await _repo.GetUserByUserNameAsync(emailOrUsername);

        if (user == null)
            return AuthResult.Fail("Invalid credentials.");

        if (!await _repo.CheckPasswordAsync(user, password))
            return AuthResult.Fail("Invalid credentials.");

        // 2FA gate: if enabled, don't issue tokens yet
        if (user.TwoFactorEnabled)
        {
            var sessionToken = GenerateTwoFactorSessionToken(user.Id);
            return AuthResult.TwoFactorRequired(user, sessionToken);
        }

        return await IssueTokensAsync(user);
    }

    public async Task<string?> TryRefreshTokenAsync(string refreshToken)
    {
        var result = await RefreshTokenAsync(refreshToken);
        return result.Success ? result.AccessToken : null;
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken)
    {
        var existing = await _repo.GetRefreshTokenAsync(refreshToken);

        if (existing == null || existing.IsRevoked || existing.IsExpired)
            return AuthResult.Fail("Invalid refresh token.");

        var user = await _repo.GetUserByIdAsync(existing.UserId);
        if (user == null)
            return AuthResult.Fail("User not found.");

        var newAccess = _jwt.GenerateAccessToken(user);
        var newRefresh = _jwt.GenerateRefreshToken();

        existing.IsRevoked = true;

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

    public async Task LogoutAllDevicesAsync(Guid userId)
    {
        await _repo.RevokeAllUserTokensAsync(userId);
        await _repo.SaveChangesAsync();
    }

    public async Task<AuthResult> MeAsync(Guid userId)
    {
        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return AuthResult.Fail("User not found.");

        return AuthResult.FromUser(user);
    }

    // ─── 2FA / TOTP ────────────────────────────────────────────────────

    public async Task<TwoFactorSetupResult> SetupTwoFactorAsync(Guid userId)
    {
        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return TwoFactorSetupResult.Fail("User not found.");

        var key = await _repo.GetOrCreateAuthenticatorKeyAsync(user);
        var uri = $"otpauth://totp/Librecord:{user.Email}?secret={key}&issuer=Librecord&digits=6";

        return new TwoFactorSetupResult
        {
            Success = true,
            SharedKey = key,
            AuthenticatorUri = uri
        };
    }

    public async Task<TwoFactorEnableResult> EnableTwoFactorAsync(Guid userId, string code)
    {
        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return TwoFactorEnableResult.Fail("User not found.");

        var valid = await _repo.VerifyTwoFactorTokenAsync(user, code);
        if (!valid)
            return TwoFactorEnableResult.Fail("Invalid verification code.");

        await _repo.SetTwoFactorEnabledAsync(user, true);
        var codes = await _repo.GenerateRecoveryCodesAsync(user, 10);

        return new TwoFactorEnableResult
        {
            Success = true,
            RecoveryCodes = codes
        };
    }

    public async Task<AuthResult> DisableTwoFactorAsync(Guid userId, string password)
    {
        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return AuthResult.Fail("User not found.");

        if (!await _repo.CheckPasswordAsync(user, password))
            return AuthResult.Fail("Invalid password.");

        await _repo.SetTwoFactorEnabledAsync(user, false);
        await _repo.ResetAuthenticatorKeyAsync(user);

        return new AuthResult { Success = true };
    }

    public async Task<AuthResult> VerifyTwoFactorLoginAsync(string sessionToken, string code)
    {
        var session = ConsumeTwoFactorSession(sessionToken);
        if (session == null)
            return AuthResult.Fail("Invalid or expired 2FA session.");

        var user = await _repo.GetUserByIdAsync(session.UserId);
        if (user == null)
            return AuthResult.Fail("User not found.");

        var valid = await _repo.VerifyTwoFactorTokenAsync(user, code);
        if (!valid)
            return AuthResult.Fail("Invalid 2FA code.");

        return await IssueTokensAsync(user);
    }

    public async Task<AuthResult> VerifyTwoFactorRecoveryAsync(string sessionToken, string recoveryCode)
    {
        var session = ConsumeTwoFactorSession(sessionToken);
        if (session == null)
            return AuthResult.Fail("Invalid or expired 2FA session.");

        var user = await _repo.GetUserByIdAsync(session.UserId);
        if (user == null)
            return AuthResult.Fail("User not found.");

        var valid = await _repo.RedeemRecoveryCodeAsync(user, recoveryCode);
        if (!valid)
            return AuthResult.Fail("Invalid recovery code.");

        return await IssueTokensAsync(user);
    }

    public async Task<TwoFactorEnableResult> RegenerateRecoveryCodesAsync(Guid userId, string password)
    {
        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return TwoFactorEnableResult.Fail("User not found.");

        if (!user.TwoFactorEnabled)
            return TwoFactorEnableResult.Fail("2FA is not enabled.");

        if (!await _repo.CheckPasswordAsync(user, password))
            return TwoFactorEnableResult.Fail("Invalid password.");

        var codes = await _repo.GenerateRecoveryCodesAsync(user, 10);
        return new TwoFactorEnableResult { Success = true, RecoveryCodes = codes };
    }

    // ─── Account recovery (password reset via codes) ─────────────────

    public async Task<AccountRecoveryResult> RecoverAccountAsync(string emailOrUsername, string recoveryCode, string newPassword)
    {
        var user = emailOrUsername.Contains('@')
            ? await _repo.GetUserByEmailAsync(emailOrUsername)
            : await _repo.GetUserByUserNameAsync(emailOrUsername);

        if (user == null)
            return AccountRecoveryResult.Fail("Invalid credentials.");

        var codeHash = HashRecoveryCode(recoveryCode.Trim());
        var code = await _repo.FindUnusedAccountRecoveryCodeAsync(user.Id, codeHash);
        if (code == null)
            return AccountRecoveryResult.Fail("Invalid recovery code.");

        code.UsedAt = DateTime.UtcNow;
        await _repo.ResetPasswordAsync(user, newPassword);
        await _repo.SaveChangesAsync();

        return new AccountRecoveryResult { Success = true };
    }

    public async Task<AccountRecoveryResult> RegenerateAccountRecoveryCodesAsync(Guid userId, string password)
    {
        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return AccountRecoveryResult.Fail("User not found.");

        if (!await _repo.CheckPasswordAsync(user, password))
            return AccountRecoveryResult.Fail("Invalid password.");

        await _repo.DeleteAccountRecoveryCodesAsync(userId);

        var (plainCodes, hashedCodes) = GenerateAccountRecoveryCodes(userId);
        await _repo.AddAccountRecoveryCodesAsync(hashedCodes);
        await _repo.SaveChangesAsync();

        return new AccountRecoveryResult { Success = true, RecoveryCodes = plainCodes };
    }

    public async Task<int> GetAccountRecoveryCodeCountAsync(Guid userId)
    {
        return await _repo.CountUnusedAccountRecoveryCodesAsync(userId);
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private async Task<AuthResult> IssueTokensAsync(User user)
    {
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

    private static string GenerateTwoFactorSessionToken(Guid userId)
    {
        // Clean up expired sessions opportunistically
        foreach (var (key, val) in TwoFactorSessions)
        {
            if (val.ExpiresAt < DateTime.UtcNow)
                TwoFactorSessions.TryRemove(key, out _);
        }

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        TwoFactorSessions[token] = new TwoFactorSession
        {
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };
        return token;
    }

    private static TwoFactorSession? ConsumeTwoFactorSession(string token)
    {
        if (!TwoFactorSessions.TryRemove(token, out var session))
            return null;

        return session.ExpiresAt < DateTime.UtcNow ? null : session;
    }

    private static (List<string> plain, List<AccountRecoveryCode> hashed) GenerateAccountRecoveryCodes(Guid userId, int count = 8)
    {
        var plain = new List<string>(count);
        var hashed = new List<AccountRecoveryCode>(count);

        for (var i = 0; i < count; i++)
        {
            var code = GenerateReadableCode();
            plain.Add(code);
            hashed.Add(new AccountRecoveryCode
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CodeHash = HashRecoveryCode(code)
            });
        }

        return (plain, hashed);
    }

    private static string GenerateReadableCode()
    {
        // Format: xxxx-xxxx-xxxx (alphanumeric, lowercase, no ambiguous chars)
        const string chars = "abcdefghjkmnpqrstuvwxyz23456789";
        Span<byte> bytes = stackalloc byte[12];
        RandomNumberGenerator.Fill(bytes);
        var sb = new StringBuilder(14);
        for (var i = 0; i < 12; i++)
        {
            if (i > 0 && i % 4 == 0) sb.Append('-');
            sb.Append(chars[bytes[i] % chars.Length]);
        }
        return sb.ToString();
    }

    private static string HashRecoveryCode(string code)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(code));
        return Convert.ToHexStringLower(hash);
    }

    private sealed class TwoFactorSession
    {
        public Guid UserId { get; init; }
        public DateTime ExpiresAt { get; init; }
    }
}
