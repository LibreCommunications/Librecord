using Librecord.Application.Models;
using Librecord.Application.Models.Results;
using Librecord.Domain.Identity;

namespace Librecord.Application.Interfaces;

public interface IUserService
{
    // ----------------------------------
    // AUTH / PROFILE
    // ----------------------------------
    Task<UserInfoResult> GetUserInfoAsync(Guid userId);

    // ----------------------------------
    // LIGHTWEIGHT USER LOOKUPS (CHAT / ETC)
    // ----------------------------------
    Task<User?> GetByIdAsync(Guid userId);
    Task<IReadOnlyList<User>> GetByIdsAsync(IEnumerable<Guid> userIds);
}