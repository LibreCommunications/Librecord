using Librecord.Domain.Identity;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Librecord.Infra.Services;

public class EmailOptions
{
    public string SmtpHost { get; set; } = "localhost";
    public int SmtpPort { get; set; } = 587;
    public string FromAddress { get; set; } = "noreply@localhost";
}

public class SmtpEmailSender : IEmailSender
{
    private readonly EmailOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendEmailVerificationAsync(string toEmail, string token, Guid userId)
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(_options.FromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Verify your Librecord email";

        var encodedToken = Uri.EscapeDataString(token);
        message.Body = new TextPart("plain")
        {
            Text = $"Enter this code or click the link to verify your email:\n\n"
                 + $"Token: {token}\n"
                 + $"User ID: {userId}\n\n"
                 + $"If you did not create a Librecord account, ignore this email."
        };

        using var client = new SmtpClient();
        try
        {
            // No TLS — internal docker network
            await client.ConnectAsync(_options.SmtpHost, _options.SmtpPort, SecureSocketOptions.None);
            await client.SendAsync(message);
            _logger.LogInformation("Verification email sent to {Email}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send verification email to {Email}", toEmail);
            throw;
        }
        finally
        {
            await client.DisconnectAsync(true);
        }
    }
}
