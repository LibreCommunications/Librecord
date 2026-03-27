using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class RegisterRequest
{
    [Required, EmailAddress, MaxLength(256)]
    public required string Email { get; set; }

    [Required, MinLength(3), MaxLength(32)]
    public required string Username { get; set; }

    [Required, MinLength(1), MaxLength(32)]
    public required string DisplayName { get; set; }

    [Required, MinLength(8), MaxLength(128)]
    public required string Password { get; set; }
}
