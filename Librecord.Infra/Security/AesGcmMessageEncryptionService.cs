using System.Security.Cryptography;
using System.Text;
using Librecord.Domain.Security;

namespace Librecord.Infra.Security;

public sealed class AesGcmMessageEncryptionService : IMessageEncryptionService
{
    private const string AlgorithmName = "HKDF-SHA256/AES-256-GCM/v1";

    private const int MasterKeySize = 32; // 256-bit
    private const int DerivedKeySize = 32;
    private const int SaltSize = 16;
    private const int NonceSize = 12; // GCM standard
    private const int TagSize = 16;   // 128-bit auth tag

    private readonly byte[] _masterKey;

    public AesGcmMessageEncryptionService(byte[] masterKey)
    {
        if (masterKey.Length != MasterKeySize)
            throw new ArgumentException(
                "Master key must be exactly 32 bytes (AES-256)");

        _masterKey = masterKey;
    }

    public EncryptedPayload Encrypt(string plaintext)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);

        var key = DeriveKey(_masterKey, salt);

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(
            nonce,
            plaintextBytes,
            ciphertext,
            tag,
            associatedData: null
        );

        // Layout: [ciphertext][tag][nonce]
        return new EncryptedPayload
        {
            Ciphertext = Concat(ciphertext, tag, nonce),
            Salt = salt,
            Algorithm = AlgorithmName
        };
    }

    public string Decrypt(
        byte[] payload,
        byte[] salt,
        string algorithm)
    {
        if (algorithm != AlgorithmName)
            throw new InvalidOperationException(
                $"Unsupported algorithm '{algorithm}'");

        if (payload.Length < TagSize + NonceSize)
            throw new CryptographicException("Invalid ciphertext payload");

        var nonce = payload[^NonceSize..];
        var tag = payload[^ (NonceSize + TagSize) .. ^NonceSize];
        var ciphertext = payload[..^ (NonceSize + TagSize)];

        var key = DeriveKey(_masterKey, salt);
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(
            nonce,
            ciphertext,
            tag,
            plaintext,
            associatedData: null
        );

        return Encoding.UTF8.GetString(plaintext);
    }

    // HKDF Extract-only (SHA-256)
    private static byte[] DeriveKey(byte[] masterKey, byte[] salt)
    {
        using var hmac = new HMACSHA256(salt);
        return hmac.ComputeHash(masterKey)[..DerivedKeySize];
    }

    private static byte[] Concat(params byte[][] arrays)
    {
        var length = arrays.Sum(a => a.Length);
        var result = new byte[length];

        var offset = 0;
        foreach (var array in arrays)
        {
            Buffer.BlockCopy(array, 0, result, offset, array.Length);
            offset += array.Length;
        }

        return result;
    }
}
