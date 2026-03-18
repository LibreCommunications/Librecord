namespace Librecord.Domain.Security;

public sealed class EncryptedPayload
{
    public required byte[] Ciphertext { get; init; }
    public required byte[] Salt { get; init; }
    public required string Algorithm { get; init; }
}