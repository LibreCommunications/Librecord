using Librecord.Infra.Security;

namespace Librecord.Tests.Infra;

public class AesGcmEncryptionTests
{
    private static AesGcmMessageEncryptionService CreateService()
    {
        var key = new byte[32];
        Random.Shared.NextBytes(key);
        return new AesGcmMessageEncryptionService(key);
    }

    [Fact]
    public void Encrypt_EmptyString_RoundTrips()
    {
        var svc = CreateService();
        var encrypted = svc.Encrypt("");
        var decrypted = svc.Decrypt(encrypted.Ciphertext, encrypted.Salt, encrypted.Algorithm);

        Assert.Equal("", decrypted);
    }

    [Fact]
    public void Encrypt_NormalString_RoundTrips()
    {
        var svc = CreateService();
        var encrypted = svc.Encrypt("hello world");
        var decrypted = svc.Decrypt(encrypted.Ciphertext, encrypted.Salt, encrypted.Algorithm);

        Assert.Equal("hello world", decrypted);
    }

    [Fact]
    public void Encrypt_EmptyString_ProducesValidPayload()
    {
        var svc = CreateService();
        var encrypted = svc.Encrypt("");

        // Layout: [ciphertext(0)][tag(16)][nonce(12)] = 28 bytes
        Assert.Equal(28, encrypted.Ciphertext.Length);
        Assert.Equal(16, encrypted.Salt.Length);
        Assert.NotNull(encrypted.Algorithm);
    }
}
