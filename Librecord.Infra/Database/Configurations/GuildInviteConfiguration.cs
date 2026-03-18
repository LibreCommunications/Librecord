using Librecord.Domain.Guilds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class GuildInviteConfiguration : IEntityTypeConfiguration<GuildInvite>
{
    public void Configure(EntityTypeBuilder<GuildInvite> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Code)
            .HasMaxLength(16)
            .IsRequired();

        builder.HasIndex(i => i.Code)
            .IsUnique();

        builder.Property(i => i.CreatedAt)
            .IsRequired();

        builder.HasOne(i => i.Guild)
            .WithMany()
            .HasForeignKey(i => i.GuildId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.Creator)
            .WithMany()
            .HasForeignKey(i => i.CreatorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
