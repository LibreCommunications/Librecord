using Librecord.Domain.Guilds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class GuildRoleConfiguration : IEntityTypeConfiguration<GuildRole>
{
    public void Configure(EntityTypeBuilder<GuildRole> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(r => r.Position)
            .IsRequired();

        builder.HasOne(r => r.Guild)
            .WithMany(g => g.Roles)
            .HasForeignKey(r => r.GuildId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}