using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class LoginRequest
{
    [Required, MaxLength(256)]
    public required string EmailOrUsername { get; set; }

    [Required, MaxLength(128)]
    public required string Password { get; set; }
}
