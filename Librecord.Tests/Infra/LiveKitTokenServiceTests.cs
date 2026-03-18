using System.IdentityModel.Tokens.Jwt;
using Librecord.Domain.Voice;
using Librecord.Infra.Services;
using Microsoft.Extensions.Options;

namespace Librecord.Tests.Infra;

public class LiveKitTokenServiceTests
{
    private readonly LiveKitOptions _opts = new()
    {
        Host = "ws://localhost:7880",
        ApiKey = "devkey",
        ApiSecret = "secret_that_is_at_least_32_chars_long!"
    };

    private LiveKitTokenService CreateService()
        => new(Options.Create(_opts));

    [Fact]
    public void GenerateToken_ReturnsNonEmptyJwt()
    {
        var svc = CreateService();
        var token = svc.GenerateToken(Guid.NewGuid(), "Alice", Guid.NewGuid());

        Assert.NotNull(token);
        Assert.NotEmpty(token);
        Assert.Contains(".", token); // JWT has 3 dot-separated parts
    }

    [Fact]
    public void GenerateToken_ContainsIdentityClaim()
    {
        var userId = Guid.NewGuid();
        var svc = CreateService();
        var jwt = svc.GenerateToken(userId, "Alice", Guid.NewGuid());

        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(jwt);

        // LiveKit SDK sets "sub" to the identity
        var sub = token.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
        Assert.Equal(userId.ToString(), sub);
    }

    [Fact]
    public void GenerateToken_DifferentInputs_ProduceDifferentTokens()
    {
        var svc = CreateService();
        var channelId = Guid.NewGuid();

        var token1 = svc.GenerateToken(Guid.NewGuid(), "Alice", channelId);
        var token2 = svc.GenerateToken(Guid.NewGuid(), "Bob", channelId);

        Assert.NotEqual(token1, token2);
    }

    [Fact]
    public void GenerateToken_HasExpiration()
    {
        var svc = CreateService();
        var jwt = svc.GenerateToken(Guid.NewGuid(), "Alice", Guid.NewGuid());

        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(jwt);

        Assert.True(token.ValidTo > DateTime.UtcNow);
        Assert.True(token.ValidTo <= DateTime.UtcNow.AddHours(7)); // ~6h TTL with some slack
    }
}
