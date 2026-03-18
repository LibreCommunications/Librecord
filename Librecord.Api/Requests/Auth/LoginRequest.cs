namespace Librecord.Api.Models.Auth;

public class LoginRequest
{
    public required string EmailOrUsername { get; set; }
    public required string Password { get; set; }
}