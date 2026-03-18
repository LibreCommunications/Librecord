using Librecord.Domain.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Librecord.Infra.Database.Seeders;

public static class UserSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var userManager = services.GetRequiredService<UserManager<User>>();

        var testUsers = new[]
        {
            new { UserName = "alice",   Email = "alice@test.com",   DisplayName = "Alice Johnson" },
            new { UserName = "bob",     Email = "bob@test.com",     DisplayName = "Bob Smith" },
            new { UserName = "charlie", Email = "charlie@test.com", DisplayName = "Charlie Davis" },
            new { UserName = "diana",   Email = "diana@test.com",   DisplayName = "Diana Lee" },
            new { UserName = "eve",     Email = "eve@test.com",     DisplayName = "Eve Martinez" },
        };

        foreach (var u in testUsers)
        {
            if (await userManager.FindByNameAsync(u.UserName) is not null)
                continue;

            var user = new User
            {
                UserName = u.UserName,
                Email = u.Email,
                DisplayName = u.DisplayName,
            };

            await userManager.CreateAsync(user, "Test1234!");
        }
    }
}
