using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Models.UserProfile;

public class UpdateDisplayNameRequest
{
    [Required, MinLength(1), MaxLength(32)]
    public string DisplayName { get; set; } = "";
}
