
namespace Librecord.Domain.Security;

public interface IMessageEncryptionService
{
    EncryptedPayload Encrypt(string plaintext);

    string Decrypt(
        byte[] ciphertext,
        byte[] salt,
        string algorithm);
}