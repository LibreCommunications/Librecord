using Librecord.Domain.Social;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class UserPresenceConfiguration : IEntityTypeConfiguration<UserPresence>
{
    public void Configure(EntityTypeBuilder<UserPresence> builder)
    {
        builder.HasKey(p => p.UserId);

        builder.Property(p => p.Activity)
            .HasMaxLength(128);

        builder.Property(p => p.Status)
            .IsRequired();

        builder.Property(p => p.LastUpdated)
            .IsRequired();

        builder.HasOne(p => p.User)
            .WithOne(u => u.Presence)
            .HasForeignKey<UserPresence>(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}