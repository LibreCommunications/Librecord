using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class VerifyEmailRequest
{
    [Required]
    public Guid UserId { get; set; }

    [Required]
    public required string Token { get; set; }
}
