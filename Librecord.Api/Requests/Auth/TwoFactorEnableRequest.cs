using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.Auth;

public class TwoFactorEnableRequest
{
    [Required, StringLength(6, MinimumLength = 6)]
    public required string Code { get; set; }
}
