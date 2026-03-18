namespace Librecord.Api.Models.Auth;

public class RegisterRequest
{
    public required string Email { get; set; }
    public required string Username { get; set; }
    public required string DisplayName { get; set; }
    public required string Password { get; set; }
}