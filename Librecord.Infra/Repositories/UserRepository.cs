using Librecord.Domain.Identity;
using Librecord.Infra.Database;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Repositories;

public class UserRepository : IUserRepository
{
    private readonly LibrecordContext _db;

    public UserRepository(LibrecordContext db)
    {
        _db = db;
    }

    public async Task<User?> GetByIdAsync(Guid id)
    {
        return await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<List<User>> GetByIdsAsync(IEnumerable<Guid> userIds)
    {
        var ids = userIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
            return new List<User>();

        return await _db.Users
            .AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToListAsync();
    }


    public async Task<User?> GetUserWithGuildsAsync(Guid id)
    {
        return await _db.Users
            .Include(u => u.GuildMemberships)
            .ThenInclude(gm => gm.Guild)
            .FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<User?> GetByUsernameAsync(string username)
    {
        return await _db.Users.FirstOrDefaultAsync(u => u.UserName == username);
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        return await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<bool> UsernameExistsAsync(string username)
    {
        return await _db.Users.AnyAsync(u => u.UserName == username);
    }

    public async Task<bool> EmailExistsAsync(string email)
    {
        return await _db.Users.AnyAsync(u => u.Email == email);
    }

    public async Task UpdateAsync(User user)
    {
        _db.Users.Update(user);
        await _db.SaveChangesAsync();
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }

    public async Task<List<User>> GetSimilarUsernamesAsync(string input, int maxResults = 10)
    {
        if (string.IsNullOrWhiteSpace(input))
            return new List<User>();

        return await _db.Users
            .Where(u =>
                u.UserName != null && (u.DisplayName.ToLower().Contains(input.ToLower()) ||
                                       u.UserName.ToLower().Contains(input.ToLower()))
            )
            .OrderBy(u => u.DisplayName.Length)
            .Take(maxResults)
            .ToListAsync();
    }
}