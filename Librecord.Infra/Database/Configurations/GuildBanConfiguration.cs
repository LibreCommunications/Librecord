using Librecord.Domain.Guilds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class GuildBanConfiguration : IEntityTypeConfiguration<GuildBan>
{
    public void Configure(EntityTypeBuilder<GuildBan> builder)
    {
        builder.HasKey(b => new { b.GuildId, b.UserId });

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        builder.HasOne(b => b.Moderator)
            .WithMany()
            .HasForeignKey(b => b.ModeratorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}