using Librecord.Domain.Identity;
using Librecord.Domain.Social;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.Property(u => u.DisplayName)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(u => u.AvatarUrl)
            .HasMaxLength(512);

        builder.Property(u => u.CreatedAt)
            .IsRequired();

        builder.HasMany(u => u.GuildMemberships)
            .WithOne(m => m.User)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(u => u.ChannelMemberships)
            .WithOne(m => m.User)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(u => u.Presence)
            .WithOne(p => p.User)
            .HasForeignKey<UserPresence>(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(u => u.UserName)
            .IsUnique();

        builder.HasIndex(u => u.Email)
            .IsUnique();
    }
}
