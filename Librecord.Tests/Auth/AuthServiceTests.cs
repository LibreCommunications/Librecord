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
    public async Task Register_Success_ReturnsTokens()
    {
        _repo.Setup(r => r.GetUserByEmailAsync("new@test.com")).ReturnsAsync((User?)null);
        _repo.Setup(r => r.GetUserByUserNameAsync("newuser")).ReturnsAsync((User?)null);
        _repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), "Pass123!"))
            .ReturnsAsync(IdentityResult.Success);
        _jwt.Setup(j => j.GenerateAccessToken(It.IsAny<User>())).Returns("access-jwt");
        _jwt.Setup(j => j.GenerateRefreshToken()).Returns("refresh-token");

        var svc = CreateService();
        var result = await svc.RegisterAsync("new@test.com", "newuser", "New User", "Pass123!");

        Assert.True(result.Success);
        Assert.Equal("access-jwt", result.AccessToken);
        Assert.Equal("refresh-token", result.RefreshToken);
        _repo.Verify(r => r.AddRefreshTokenAsync(It.Is<RefreshToken>(t =>
            t.Token == "refresh-token"
        )), Times.Once);
        _repo.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task Register_DuplicateEmail_Fails()
    {
        _repo.Setup(r => r.GetUserByEmailAsync("taken@test.com")).ReturnsAsync(MakeUser());

        var svc = CreateService();
        var result = await svc.RegisterAsync("taken@test.com", "newuser", "u", "Pass123!");

        Assert.False(result.Success);
        Assert.Contains("Email", result.Error);
    }

    [Fact]
    public async Task Register_DuplicateUsername_Fails()
    {
        _repo.Setup(r => r.GetUserByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _repo.Setup(r => r.GetUserByUserNameAsync("alice")).ReturnsAsync(MakeUser());

        var svc = CreateService();
        var result = await svc.RegisterAsync("new@test.com", "alice", "u", "Pass123!");

        Assert.False(result.Success);
        Assert.Contains("Username", result.Error);
    }

    [Fact]
    public async Task Register_IdentityFailure_ReturnsErrors()
    {
        _repo.Setup(r => r.GetUserByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _repo.Setup(r => r.GetUserByUserNameAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _repo.Setup(r => r.CreateUserAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Weak password" }));

        var svc = CreateService();
        var result = await svc.RegisterAsync("a@b.com", "user", "u", "123");

        Assert.False(result.Success);
        Assert.Contains("Weak password", result.Error);
    }

    // ---------------------------------------------------------
    // LOGIN
    // ---------------------------------------------------------

    [Fact]
    public async Task Login_WithEmail_ReturnsTokens()
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
    }

    [Fact]
    public async Task Login_WithUsername_ReturnsTokens()
    {
        var user = MakeUser();
        _repo.Setup(r => r.GetUserByUserNameAsync("alice")).ReturnsAsync(user);
        _repo.Setup(r => r.CheckPasswordAsync(user, "Pass123!")).ReturnsAsync(true);
        _jwt.Setup(j => j.GenerateAccessToken(user)).Returns("access");
        _jwt.Setup(j => j.GenerateRefreshToken()).Returns("refresh");

        var svc = CreateService();
        var result = await svc.LoginAsync("alice", "Pass123!");

        Assert.True(result.Success);
    }

    [Fact]
    public async Task Login_UserNotFound_Fails()
    {
        _repo.Setup(r => r.GetUserByUserNameAsync("nobody")).ReturnsAsync((User?)null);

        var svc = CreateService();
        var result = await svc.LoginAsync("nobody", "Pass123!");

        Assert.False(result.Success);
        Assert.Contains("Invalid credentials", result.Error);
    }

    [Fact]
    public async Task Login_WrongPassword_Fails()
    {
        var user = MakeUser();
        _repo.Setup(r => r.GetUserByUserNameAsync("alice")).ReturnsAsync(user);
        _repo.Setup(r => r.CheckPasswordAsync(user, "wrong")).ReturnsAsync(false);

        var svc = CreateService();
        var result = await svc.LoginAsync("alice", "wrong");

        Assert.False(result.Success);
        Assert.Contains("Invalid credentials", result.Error);
    }

    // ---------------------------------------------------------
    // REFRESH TOKEN
    // ---------------------------------------------------------

    [Fact]
    public async Task RefreshToken_Valid_RotatesTokens()
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
    public async Task RefreshToken_Expired_Fails()
    {
        var existing = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Token = "expired",
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            IsRevoked = false
        };

        _repo.Setup(r => r.GetRefreshTokenAsync("expired")).ReturnsAsync(existing);

        var svc = CreateService();
        var result = await svc.RefreshTokenAsync("expired");

        Assert.False(result.Success);
    }

    [Fact]
    public async Task RefreshToken_NotFound_Fails()
    {
        _repo.Setup(r => r.GetRefreshTokenAsync("nonexistent")).ReturnsAsync((RefreshToken?)null);

        var svc = CreateService();
        var result = await svc.RefreshTokenAsync("nonexistent");

        Assert.False(result.Success);
    }

    // ---------------------------------------------------------
    // ME
    // ---------------------------------------------------------

    [Fact]
    public async Task Me_ExistingUser_ReturnsInfo()
    {
        var user = MakeUser();
        _repo.Setup(r => r.GetUserByIdAsync(user.Id)).ReturnsAsync(user);

        var svc = CreateService();
        var result = await svc.MeAsync(user.Id);

        Assert.True(result.Success);
        Assert.Equal(user.Id, result.UserId);
    }

    [Fact]
    public async Task Me_UnknownUser_Fails()
    {
        _repo.Setup(r => r.GetUserByIdAsync(It.IsAny<Guid>())).ReturnsAsync((User?)null);

        var svc = CreateService();
        var result = await svc.MeAsync(Guid.NewGuid());

        Assert.False(result.Success);
    }
}
