using System.Security.Claims;
using Librecord.Api.Dtos.Auth;
using Librecord.Api.Hubs;
using Librecord.Api.Models.Auth;
using Librecord.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("auth")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly IWebHostEnvironment _env;
    private readonly IHubContext<AppHub> _hub;

    public AuthController(IAuthService auth, IWebHostEnvironment env, IHubContext<AppHub> hub)
    {
        _auth = auth;
        _env = env;
        _hub = hub;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthDto>> Register(RegisterRequest request)
    {
        var result = await _auth.RegisterAsync(
            request.Email,
            request.Username,
            request.DisplayName,
            request.Password);

        if (!result.Success)
            return BadRequest(AuthDto.From(result));

        SetAuthCookies(result.AccessToken!, result.RefreshToken!);
        return Ok(AuthDto.From(result));
    }


    [HttpPost("login")]
    public async Task<ActionResult<AuthDto>> Login(LoginRequest request)
    {
        var result = await _auth.LoginAsync(
            request.EmailOrUsername,
            request.Password);

        if (!result.Success)
            return Unauthorized(AuthDto.From(result));

        // 2FA required — don't issue cookies yet, return session token
        if (result.RequiresTwoFactor)
            return Ok(AuthDto.From(result));

        SetAuthCookies(result.AccessToken!, result.RefreshToken!);
        return Ok(AuthDto.From(result));
    }


    [HttpPost("refresh")]
    public async Task<ActionResult<AuthDto>> Refresh()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (string.IsNullOrEmpty(refreshToken))
        {
            return Unauthorized(new AuthDto
            {
                Success = false,
                Error = "Missing refresh token"
            });
        }

        var result = await _auth.RefreshTokenAsync(refreshToken);

        if (!result.Success)
            return Unauthorized(AuthDto.From(result));

        SetAuthCookies(result.AccessToken!, result.RefreshToken!);
        return Ok(AuthDto.From(result));
    }


    [HttpPost("logout")]
    public ActionResult<AuthDto> Logout()
    {
        Response.Cookies.Delete("accessToken");
        Response.Cookies.Delete("refreshToken");

        return Ok(new AuthDto { Success = true });
    }

    [Authorize]
    [HttpPost("logout-all")]
    public async Task<ActionResult<AuthDto>> LogoutAll()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Revoke all refresh tokens in the database
        await _auth.LogoutAllDevicesAsync(userId);

        // Tell all connected sessions to log out
        await _hub.Clients.User(userId.ToString()).SendAsync("auth:session:revoked");

        // Clear this device's cookies too
        Response.Cookies.Delete("accessToken");
        Response.Cookies.Delete("refreshToken");

        return Ok(new AuthDto { Success = true });
    }


    [HttpPost("recover-account")]
    public async Task<IActionResult> RecoverAccount([FromBody] RecoverAccountRequest request)
    {
        var result = await _auth.RecoverAccountAsync(request.EmailOrUsername, request.RecoveryCode, request.NewPassword);
        if (!result.Success)
            return BadRequest(new { result.Success, result.Error });
        return Ok(new { result.Success });
    }

    [Authorize]
    [HttpPost("recovery-codes/regenerate")]
    public async Task<IActionResult> RegenerateAccountRecoveryCodes([FromBody] PasswordConfirmRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _auth.RegenerateAccountRecoveryCodesAsync(userId, request.Password);
        if (!result.Success)
            return BadRequest(new { result.Success, result.Error });
        return Ok(new { result.Success, result.RecoveryCodes });
    }

    [Authorize]
    [HttpGet("recovery-codes/count")]
    public async Task<IActionResult> GetRecoveryCodeCount()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var count = await _auth.GetAccountRecoveryCodeCountAsync(userId);
        return Ok(new { count });
    }

    [HttpPost("2fa/verify")]
    public async Task<ActionResult<AuthDto>> VerifyTwoFactor([FromBody] TwoFactorVerifyRequest request)
    {
        var result = await _auth.VerifyTwoFactorLoginAsync(request.SessionToken, request.Code);
        if (!result.Success)
            return Unauthorized(AuthDto.From(result));

        SetAuthCookies(result.AccessToken!, result.RefreshToken!);
        return Ok(AuthDto.From(result));
    }

    [HttpPost("2fa/recovery")]
    public async Task<ActionResult<AuthDto>> VerifyTwoFactorRecovery([FromBody] TwoFactorRecoveryRequest request)
    {
        var result = await _auth.VerifyTwoFactorRecoveryAsync(request.SessionToken, request.RecoveryCode);
        if (!result.Success)
            return Unauthorized(AuthDto.From(result));

        SetAuthCookies(result.AccessToken!, result.RefreshToken!);
        return Ok(AuthDto.From(result));
    }

    private void SetAuthCookies(string accessToken, string refreshToken)
    {
        Response.Cookies.Append("accessToken", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddMinutes(15)
        });

        Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });
    }
}