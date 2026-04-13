using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class RecoverAccountRequest
{
    [Required]
    public required string EmailOrUsername { get; set; }

    [Required]
    public required string RecoveryCode { get; set; }

    [Required]
    [MinLength(6)]
    public required string NewPassword { get; set; }
}
