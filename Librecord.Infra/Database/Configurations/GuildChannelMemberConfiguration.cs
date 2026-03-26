using Librecord.Domain.Guilds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public sealed class GuildChannelMemberConfiguration
    : IEntityTypeConfiguration<GuildChannelMember>
{
    public void Configure(EntityTypeBuilder<GuildChannelMember> builder)
    {
        builder.HasKey(x => new { x.UserId, x.ChannelId });

        builder.Property(x => x.JoinedAt)
            .IsRequired();

        builder.HasOne(x => x.User)
            .WithMany(u => u.ChannelMemberships)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Channel)
            .WithMany(c => c.Members)
            .HasForeignKey(x => x.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}