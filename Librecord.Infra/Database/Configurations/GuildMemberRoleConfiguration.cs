using Librecord.Domain.Guilds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class GuildMemberRoleConfiguration : IEntityTypeConfiguration<GuildMemberRole>
{
    public void Configure(EntityTypeBuilder<GuildMemberRole> builder)
    {
        builder.HasKey(r => new { r.UserId, r.GuildId, r.RoleId });
        
        builder.HasOne(r => r.GuildMember)
            .WithMany(m => m.Roles)
            .HasForeignKey(r => new { r.UserId, r.GuildId })
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Role)
            .WithMany(r => r.Members)
            .HasForeignKey(r => r.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}