namespace Librecord.Domain.Identity;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<List<User>> GetByIdsAsync(IEnumerable<Guid> userIds);

    Task<User?> GetUserWithGuildsAsync(Guid id);

    Task<User?> GetByUsernameAsync(string username);
    Task<User?> GetByEmailAsync(string email);

    Task<bool> UsernameExistsAsync(string username);
    Task<bool> EmailExistsAsync(string email);

    Task UpdateAsync(User user);
    Task SaveChangesAsync();

    Task<List<User>> GetSimilarUsernamesAsync(string input, int maxResults = 10);
}