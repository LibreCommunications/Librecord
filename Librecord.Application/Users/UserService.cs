using Librecord.Application.Interfaces;
using Librecord.Application.Models;
using Librecord.Application.Models.Results;
using Librecord.Domain.Identity;
using Librecord.Domain.Storage;

namespace Librecord.Application.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _users;
    private readonly IAttachmentStorageService _storage;

    public UserService(IUserRepository users, IAttachmentStorageService storage)
    {
        _users = users;
        _storage = storage;
    }

    public async Task<UserInfoResult> GetUserInfoAsync(Guid userId)
    {
        var user = await _users.GetUserWithGuildsAsync(userId);

        if (user == null)
            return UserInfoResult.Fail("User not found.");

        return UserInfoResult.FromUser(user);
    }

    public Task<User?> GetByIdAsync(Guid userId)
    {
        return _users.GetByIdAsync(userId);
    }

    public async Task<IReadOnlyList<User>> GetByIdsAsync(IEnumerable<Guid> userIds)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
            return Array.Empty<User>();

        return await _users.GetByIdsAsync(ids);
    }

    public async Task<string?> UpdateDisplayNameAsync(Guid userId, string displayName)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        user.DisplayName = displayName;
        await _users.UpdateAsync(user);
        await _users.SaveChangesAsync();
        return user.DisplayName;
    }

    public async Task<string?> UpdateAvatarAsync(Guid userId, Stream fileStream, string fileName, string contentType)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(user.AvatarUrl))
        {
            var oldKey = user.AvatarUrl.Replace("/cdn/", "");
            try { await _storage.DeleteAsync(oldKey); } catch { }
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var fileId = Guid.NewGuid().ToString("N");
        var objectName = $"avatars/{userId}/{fileId}{ext}";

        await _storage.UploadAsync(objectName, fileStream, contentType);

        user.AvatarUrl = $"/cdn/public/{objectName}";
        await _users.UpdateAsync(user);
        await _users.SaveChangesAsync();

        return user.AvatarUrl;
    }

    public async Task<bool> UpdateBioAsync(Guid userId, string? bio)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return false;

        user.Bio = bio?.Trim();
        await _users.UpdateAsync(user);
        await _users.SaveChangesAsync();
        return true;
    }

    public async Task<string?> UpdateBannerAsync(Guid userId, Stream fileStream, string fileName, string contentType)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(user.BannerUrl))
        {
            var oldKey = user.BannerUrl.Replace("/cdn/", "");
            try { await _storage.DeleteAsync(oldKey); } catch { }
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var fileId = Guid.NewGuid().ToString("N");
        var objectName = $"banners/{userId}/{fileId}{ext}";

        await _storage.UploadAsync(objectName, fileStream, contentType);

        user.BannerUrl = $"/cdn/public/{objectName}";
        await _users.UpdateAsync(user);
        await _users.SaveChangesAsync();

        return user.BannerUrl;
    }

    public async Task<bool> UpdateMutualFriendsVisibleAsync(Guid userId, bool visible)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return false;
        user.MutualFriendsVisible = visible;
        await _users.UpdateAsync(user);
        await _users.SaveChangesAsync();
        return true;
    }
}