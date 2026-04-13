using System.Security.Claims;
using Librecord.Api.Models.Auth;
using Librecord.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Librecord.Api.Controllers;

[Authorize]
[ApiController]
[Route("auth/2fa")]
[EnableRateLimiting("auth")]
public class TwoFactorController : ControllerBase
{
    private readonly IAuthService _auth;

    public TwoFactorController(IAuthService auth)
    {
        _auth = auth;
    }

    /// <summary>
    /// Returns a shared TOTP key and otpauth:// URI for QR code generation.
    /// </summary>
    [HttpPost("setup")]
    public async Task<IActionResult> Setup()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _auth.SetupTwoFactorAsync(userId);

        if (!result.Success)
            return BadRequest(new { result.Error });

        return Ok(new
        {
            sharedKey = result.SharedKey,
            authenticatorUri = result.AuthenticatorUri
        });
    }

    /// <summary>
    /// Verifies a TOTP code and enables 2FA. Returns recovery codes.
    /// </summary>
    [HttpPost("enable")]
    public async Task<IActionResult> Enable([FromBody] TwoFactorEnableRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _auth.EnableTwoFactorAsync(userId, request.Code);

        if (!result.Success)
            return BadRequest(new { result.Error });

        return Ok(new { recoveryCodes = result.RecoveryCodes });
    }

    /// <summary>
    /// Disables 2FA. Requires password confirmation.
    /// </summary>
    [HttpPost("disable")]
    public async Task<IActionResult> Disable([FromBody] TwoFactorDisableRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _auth.DisableTwoFactorAsync(userId, request.Password);

        if (!result.Success)
            return BadRequest(new { result.Error });

        return Ok(new { success = true });
    }

    /// <summary>
    /// Regenerates recovery codes. Requires password confirmation.
    /// </summary>
    [HttpPost("regenerate-recovery-codes")]
    public async Task<IActionResult> RegenerateRecoveryCodes([FromBody] TwoFactorDisableRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _auth.RegenerateRecoveryCodesAsync(userId, request.Password);

        if (!result.Success)
            return BadRequest(new { result.Error });

        return Ok(new { recoveryCodes = result.RecoveryCodes });
    }
}
