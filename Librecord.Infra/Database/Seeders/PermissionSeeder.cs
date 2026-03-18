using Librecord.Domain.Permissions;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Database.Seeders;

public static class PermissionSeeder
{
    public static void Seed(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Permission>().HasData(
            KnownPermissions.All.Select(p => new Permission
            {
                Id = p.Id,
                Name = p.Perm.Key,
                Type = p.Type
            })
        );
    }
}