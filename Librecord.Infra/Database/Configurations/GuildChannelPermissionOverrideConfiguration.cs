using Librecord.Domain.Guilds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class GuildChannelPermissionOverrideConfiguration
    : IEntityTypeConfiguration<GuildChannelPermissionOverride>
{
    public void Configure(EntityTypeBuilder<GuildChannelPermissionOverride> builder)
    {
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Allow)
            .IsRequired(false);

        builder.HasOne(o => o.Channel)
            .WithMany(c => c.PermissionOverrides)
            .HasForeignKey(o => o.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(o => o.Permission)
            .WithMany()
            .HasForeignKey(o => o.PermissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(o => o.Role)
            .WithMany()
            .HasForeignKey(o => o.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(o => o.User)
            .WithMany()
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}