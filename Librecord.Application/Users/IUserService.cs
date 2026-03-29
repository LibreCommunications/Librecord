using Librecord.Application.Models;
using Librecord.Application.Models.Results;
using Librecord.Domain.Identity;

namespace Librecord.Application.Interfaces;

public interface IUserService
{
    Task<UserInfoResult> GetUserInfoAsync(Guid userId);

    Task<User?> GetByIdAsync(Guid userId);
    Task<IReadOnlyList<User>> GetByIdsAsync(IEnumerable<Guid> userIds);

    Task<string?> UpdateDisplayNameAsync(Guid userId, string displayName);
    Task<string?> UpdateAvatarAsync(Guid userId, Stream fileStream, string fileName, string contentType);
    Task<bool> UpdateBioAsync(Guid userId, string? bio);
    Task<string?> UpdateBannerAsync(Guid userId, Stream fileStream, string fileName, string contentType);
}