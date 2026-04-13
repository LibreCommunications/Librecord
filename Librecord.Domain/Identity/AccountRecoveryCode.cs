namespace Librecord.Domain.Identity;

public class AccountRecoveryCode
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    /// <summary>SHA-256 hash of the plain-text recovery code.</summary>
    public required string CodeHash { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UsedAt { get; set; }
}
