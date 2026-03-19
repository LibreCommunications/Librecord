using Librecord.Api.Dtos.Auth;
using Librecord.Api.Models.Auth;
using Librecord.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly IWebHostEnvironment _env;

    public AuthController(IAuthService auth, IWebHostEnvironment env)
    {
        _auth = auth;
        _env = env;
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