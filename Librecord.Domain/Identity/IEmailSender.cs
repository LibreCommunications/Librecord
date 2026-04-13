namespace Librecord.Domain.Identity;

public interface IEmailSender
{
    Task SendEmailVerificationAsync(string toEmail, string token, Guid userId);
}
