using Librecord.Domain.Identity;
using Librecord.Infra.Database;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class AuthRepository : IAuthRepository
{
    private readonly LibrecordContext _db;
    private readonly UserManager<User> _userManager;

    public AuthRepository(UserManager<User> userManager, LibrecordContext db)
    {
        _userManager = userManager;
        _db = db;
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        return await _userManager.Users
            .FirstOrDefaultAsync(x => x.Email == email);
    }

    public async Task<User?> GetUserByUserNameAsync(string username)
    {
        return await _userManager.Users
            .FirstOrDefaultAsync(x => x.UserName == username);
    }

    public async Task<bool> CheckPasswordAsync(User user, string password)
    {
        return await _userManager.CheckPasswordAsync(user, password);
    }

    public async Task<IdentityResult> CreateUserAsync(User user, string password)
    {
        return await _userManager.CreateAsync(user, password);
    }

    // ---------------------------------------------------------
    // REFRESH TOKENS
    // ---------------------------------------------------------

    public async Task AddRefreshTokenAsync(RefreshToken token)
    {
        await _db.Set<RefreshToken>().AddAsync(token);
    }

    public async Task<RefreshToken?> GetRefreshTokenAsync(string token)
    {
        return await _db.Set<RefreshToken>()
            .FirstOrDefaultAsync(x => x.Token == token && !x.IsRevoked);
    }

    public async Task<User?> GetUserByIdAsync(Guid id)
    {
        return await _userManager.Users.FirstOrDefaultAsync(x => x.Id == id);
    }


    public async Task RevokeRefreshTokenAsync(RefreshToken token)
    {
        token.IsRevoked = true;
        _db.Update(token);
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}