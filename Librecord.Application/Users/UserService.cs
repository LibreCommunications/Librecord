using Librecord.Application.Interfaces;
using Librecord.Application.Models;
using Librecord.Application.Models.Results;
using Librecord.Domain.Identity;

namespace Librecord.Application.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _users;

    public UserService(IUserRepository users)
    {
        _users = users;
    }

    public async Task<UserInfoResult> GetUserInfoAsync(Guid userId)
    {
        // Load user WITH guilds included
        var user = await _users.GetUserWithGuildsAsync(userId);

        if (user == null)
            return UserInfoResult.Fail("User not found.");

        return UserInfoResult.FromUser(user);
    }

    // ----------------------------------
    // LIGHT LOOKUPS
    // ----------------------------------
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
}