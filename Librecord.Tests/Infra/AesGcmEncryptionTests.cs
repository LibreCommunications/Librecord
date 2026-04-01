using System.Security.Cryptography;
using Librecord.Infra.Security;

namespace Librecord.Tests.Infra;

public class AesGcmEncryptionTests
{
    private static AesGcmMessageEncryptionService CreateService()
    {
        var key = new byte[32];
        RandomNumberGenerator.Fill(key);
        return new AesGcmMessageEncryptionService(key);
    }

    private static AesGcmMessageEncryptionService CreateService(byte[] key)
    {
        return new AesGcmMessageEncryptionService(key);
    }

    [Fact]
    public void When_EncryptingAndDecryptingText_Should_ReturnOriginal()
    {
        var svc = CreateService();
        var original = "hello world";

        var encrypted = svc.Encrypt(original);
        var decrypted = svc.Decrypt(encrypted.Ciphertext, encrypted.Salt, encrypted.Algorithm);

        Assert.Equal(original, decrypted);
    }

    [Fact]
    public void When_EncryptingEmptyString_Should_HandleGracefully()
    {
        var svc = CreateService();

        var encrypted = svc.Encrypt("");
        var decrypted = svc.Decrypt(encrypted.Ciphertext, encrypted.Salt, encrypted.Algorithm);

        Assert.Equal("", decrypted);
        // Layout: [ciphertext(0)][tag(16)][nonce(12)] = 28 bytes minimum
        Assert.Equal(28, encrypted.Ciphertext.Length);
    }

    [Fact]
    public void When_EncryptingWithDifferentSalts_Should_ProduceDifferentCiphertexts()
    {
        var svc = CreateService();
        var plaintext = "same message";

        var encrypted1 = svc.Encrypt(plaintext);
        var encrypted2 = svc.Encrypt(plaintext);

        // Each encryption uses a random salt and nonce, so ciphertexts differ
        Assert.NotEqual(encrypted1.Ciphertext, encrypted2.Ciphertext);
        Assert.NotEqual(encrypted1.Salt, encrypted2.Salt);
    }

    [Fact]
    public void When_DecryptingWithWrongKey_Should_Fail()
    {
        var key1 = new byte[32];
        var key2 = new byte[32];
        RandomNumberGenerator.Fill(key1);
        RandomNumberGenerator.Fill(key2);

        var svc1 = CreateService(key1);
        var svc2 = CreateService(key2);

        var encrypted = svc1.Encrypt("secret message");

        Assert.ThrowsAny<CryptographicException>(() =>
            svc2.Decrypt(encrypted.Ciphertext, encrypted.Salt, encrypted.Algorithm));
    }
}
