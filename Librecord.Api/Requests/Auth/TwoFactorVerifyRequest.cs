using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class TwoFactorVerifyRequest
{
    [Required]
    public required string SessionToken { get; set; }

    [Required, StringLength(6, MinimumLength = 6)]
    public required string Code { get; set; }
}
