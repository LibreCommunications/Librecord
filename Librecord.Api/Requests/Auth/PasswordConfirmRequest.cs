using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class PasswordConfirmRequest
{
    [Required]
    public required string Password { get; set; }
}
