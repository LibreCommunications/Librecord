using Librecord.Application.Services;
using Librecord.Domain.Identity;
using Librecord.Domain.Security;
using Microsoft.AspNetCore.Identity;
using Moq;

namespace Librecord.Tests.Auth;

public class AuthServiceTests
{
    private readonly Mock<IAuthRepository> _repo = new();
    private readonly Mock<IJwtTokenGenerator> _jwt = new();

    private AuthService CreateService() => new(_repo.Object, _jwt.Object);

    private static User MakeUser(string username = "alice", string email = "alice@test.com") => new()
    {
        Id = Guid.NewGuid(),
        UserName = username,
        Email = email,
        DisplayName = username
    };

    // ---------------------------------------------------------
    // REGISTER
    // ---------------------------------------------------------

    [Fact]
    public async Task When_RegisteringWithValidCredentials_Should_ReturnTokens()
    {
        _repo.Setup(r => r.GetUserByEmailAsync("new@test.com")).ReturnsAsync((User?)null);
        _repo.Setup(r => r.GetUserByUserNameAsync("newuser")).ReturnsAsync((User?)null);
        _repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), "StrongPass1!"))
            .ReturnsAsync(IdentityResult.Success);
        _jwt.Setup(j => j.GenerateAccessToken(It.IsAny<User>())).Returns("access-jwt");
        _jwt.Setup(j => j.GenerateRefreshToken()).Returns("refresh-token");

        var svc = CreateService();
        var result = await svc.RegisterAsync("new@test.com", "newuser", "New User", "StrongPass1!");

        Assert.True(result.Success);
        Assert.Equal("access-jwt", result.AccessToken);
        Assert.Equal("refresh-token", result.RefreshToken);
    }

    [Fact]
    public async Task When_RegisteringWithExistingEmail_Should_Fail()
    {
        _repo.Setup(r => r.GetUserByEmailAsync("taken@test.com")).ReturnsAsync(MakeUser());

        var svc = CreateService();
        var result = await svc.RegisterAsync("taken@test.com", "newuser", "u", "StrongPass1!");

        Assert.False(result.Success);
        Assert.Contains("Email", result.Error);
    }

    [Fact]
    public async Task When_RegisteringWithShortPassword_Should_Fail()
    {
        _repo.Setup(r => r.GetUserByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _repo.Setup(r => r.GetUserByUserNameAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError
            {
                Code = "PasswordTooShort",
                Description = "Password too short"
            }));

        var svc = CreateService();
        var result = await svc.RegisterAsync("a@b.com", "user", "u", "123");

        Assert.False(result.Success);
        Assert.Contains("Password too short", result.Error);
    }

    // ---------------------------------------------------------
    // LOGIN
    // ---------------------------------------------------------

    [Fact]
    public async Task When_LoggingInWithCorrectPassword_Should_ReturnTokens()
    {
        var user = MakeUser();
        _repo.Setup(r => r.GetUserByEmailAsync("alice@test.com")).ReturnsAsync(user);
        _repo.Setup(r => r.CheckPasswordAsync(user, "Pass123!")).ReturnsAsync(true);
        _jwt.Setup(j => j.GenerateAccessToken(user)).Returns("access");
        _jwt.Setup(j => j.GenerateRefreshToken()).Returns("refresh");

        var svc = CreateService();
        var result = await svc.LoginAsync("alice@test.com", "Pass123!");

        Assert.True(result.Success);
        Assert.Equal("access", result.AccessToken);
        Assert.Equal("refresh", result.RefreshToken);
    }

    [Fact]
    public async Task When_LoggingInWithWrongPassword_Should_Fail()
    {
        var user = MakeUser();
        _repo.Setup(r => r.GetUserByUserNameAsync("alice")).ReturnsAsync(user);
        _repo.Setup(r => r.CheckPasswordAsync(user, "wrong")).ReturnsAsync(false);

        var svc = CreateService();
        var result = await svc.LoginAsync("alice", "wrong");

        Assert.False(result.Success);
        Assert.Contains("Invalid credentials", result.Error);
    }

    [Fact]
    public async Task When_LoggingInWithNonexistentUser_Should_Fail()
    {
        _repo.Setup(r => r.GetUserByUserNameAsync("nobody")).ReturnsAsync((User?)null);

        var svc = CreateService();
        var result = await svc.LoginAsync("nobody", "Pass123!");

        Assert.False(result.Success);
        Assert.Contains("Invalid credentials", result.Error);
    }

    // ---------------------------------------------------------
    // REFRESH TOKEN
    // ---------------------------------------------------------

    [Fact]
    public async Task When_RefreshingValidToken_Should_ReturnNewTokens()
    {
        var user = MakeUser();
        var existing = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = "old-refresh",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        };

        _repo.Setup(r => r.GetRefreshTokenAsync("old-refresh")).ReturnsAsync(existing);
        _repo.Setup(r => r.GetUserByIdAsync(user.Id)).ReturnsAsync(user);
        _jwt.Setup(j => j.GenerateAccessToken(user)).Returns("new-access");
        _jwt.Setup(j => j.GenerateRefreshToken()).Returns("new-refresh");

        var svc = CreateService();
        var result = await svc.RefreshTokenAsync("old-refresh");

        Assert.True(result.Success);
        Assert.Equal("new-access", result.AccessToken);
        Assert.Equal("new-refresh", result.RefreshToken);
        Assert.True(existing.IsRevoked);
    }

    [Fact]
    public async Task When_RefreshingInvalidToken_Should_Fail()
    {
        _repo.Setup(r => r.GetRefreshTokenAsync("nonexistent")).ReturnsAsync((RefreshToken?)null);

        var svc = CreateService();
        var result = await svc.RefreshTokenAsync("nonexistent");

        Assert.False(result.Success);
    }
}
