namespace Librecord.Domain.Security;

public class JwtOptions
{
    public string Issuer { get; set; } = null!;
    public string Audience { get; set; } = null!;
    public string SigningKey { get; set; } = null!;

    public int AccessTokenMinutes { get; set; } = 15; // Standard
    public int RefreshTokenDays { get; set; } = 14; // Standard
}