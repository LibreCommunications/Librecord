using Librecord.Api.Models.UserProfile;
using Librecord.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("users")]
public class UserProfileController : AuthenticatedController
{
    private readonly IUserService _users;

    public UserProfileController(IUserService users)
    {
        _users = users;
    }

    [Authorize]
    [HttpPost("display-name")]
    public async Task<IActionResult> UpdateDisplayName([FromBody] UpdateDisplayNameRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName))
            return BadRequest("Display name cannot be empty.");

        if (request.DisplayName.Length > 32)
            return BadRequest("Display name is too long.");

        var displayName = await _users.UpdateDisplayNameAsync(UserId, request.DisplayName);
        if (displayName == null) return Unauthorized();

        return Ok(new { displayName });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMyInfo()
    {
        var result = await _users.GetUserInfoAsync(UserId);

        if (!result.Success)
            return BadRequest(new { error = result.Error });

        return Ok(result);
    }

    [Authorize]
    [HttpPost("avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file.Length == 0)
            return BadRequest("Invalid file.");

        var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".webp" };
        var ext = Path.GetExtension(file.FileName).ToLower();

        if (!allowedExtensions.Contains(ext))
            return BadRequest("Unsupported file type.");

        if (file.Length > Librecord.Application.Limits.MaxAvatarSize)
            return BadRequest("File too large.");

        await using var stream = file.OpenReadStream();
        var contentType = FileSignature.Detect(stream, file.ContentType);
        var avatarUrl = await _users.UpdateAvatarAsync(UserId, stream, file.FileName, contentType);
        if (avatarUrl == null) return Unauthorized();

        return Ok(new { avatarUrl });
    }
}
