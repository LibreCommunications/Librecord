using Librecord.Api.Models.UserProfile;
using Librecord.Application.Interfaces;
using Librecord.Domain.Social;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("users")]
public class UserProfileController : AuthenticatedController
{
    private readonly IUserService _users;
    private readonly IFriendshipRepository _friendships;

    public UserProfileController(IUserService users, IFriendshipRepository friendships)
    {
        _users = users;
        _friendships = friendships;
    }

    [Authorize]
    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> GetProfile(Guid userId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return NotFound();

        var isFriend = await _friendships.UsersAreConfirmedFriendsAsync(UserId, userId);

        return Ok(new
        {
            id = user.Id,
            username = user.UserName,
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            bio = user.Bio,
            bannerUrl = user.BannerUrl,
            createdAt = user.CreatedAt,
            isFriend,
            isSelf = user.Id == UserId,
        });
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
    [HttpPut("bio")]
    public async Task<IActionResult> UpdateBio([FromBody] UpdateBioRequest request)
    {
        if (request.Bio != null && request.Bio.Length > 500)
            return BadRequest("Bio must be 500 characters or less.");

        var ok = await _users.UpdateBioAsync(UserId, request.Bio);
        return ok ? Ok() : Unauthorized();
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

    [Authorize]
    [HttpPost("banner")]
    public async Task<IActionResult> UploadBanner(IFormFile file)
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
        var bannerUrl = await _users.UpdateBannerAsync(UserId, stream, file.FileName, contentType);
        if (bannerUrl == null) return Unauthorized();

        return Ok(new { bannerUrl });
    }
}

public class UpdateBioRequest
{
    public string? Bio { get; set; }
}
