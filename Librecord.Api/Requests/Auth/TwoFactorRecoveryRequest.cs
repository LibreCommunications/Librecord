using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class TwoFactorRecoveryRequest
{
    [Required]
    public required string SessionToken { get; set; }

    [Required]
    public required string RecoveryCode { get; set; }
}
