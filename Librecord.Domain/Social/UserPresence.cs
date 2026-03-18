using Librecord.Domain.Identity;

namespace Librecord.Domain.Social;

public class UserPresence
{
    public Guid UserId { get; set; }

    public string Activity { get; set; } = "";
    public UserStatus Status { get; set; } = UserStatus.Online;

    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}