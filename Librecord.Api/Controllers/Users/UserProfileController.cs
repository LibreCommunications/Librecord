using System.Security.Claims;
using Librecord.Api.Models.UserProfile;
using Librecord.Application.Interfaces;
using Librecord.Domain.Storage;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

[ApiController]
[Route("users")]
public class UserProfileController : AuthenticatedController
{
    private readonly LibrecordContext _db;
    private readonly IAttachmentStorageService _storage;
    private readonly IUserService _users;

    public UserProfileController(
        IAttachmentStorageService storage,
        LibrecordContext db,
        IUserService users)
    {
        _storage = storage;
        _db = db;
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

        var userId = UserId;

        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return Unauthorized();

        user.DisplayName = request.DisplayName;
        await _db.SaveChangesAsync();

        return Ok(new { displayName = user.DisplayName });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMyInfo()
    {
        var userId = UserId;

        var result = await _users.GetUserInfoAsync(userId);

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

        var userId = UserId;
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Unauthorized();

        // Delete old avatar
        if (!string.IsNullOrEmpty(user.AvatarUrl))
        {
            var oldKey = user.AvatarUrl.Replace("/cdn/", "");
            await _storage.DeleteAsync(oldKey);
        }

        // New file ID to avoid caching issues
        var fileId = Guid.NewGuid().ToString("N");
        var objectName = $"avatars/{userId}/{fileId}{ext}";

        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(objectName, stream, file.ContentType);

        user.AvatarUrl = $"/cdn/public/{objectName}";
        await _db.SaveChangesAsync();

        return Ok(new { avatarUrl = user.AvatarUrl });
    }
}