using Librecord.Domain.Messaging.Direct;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class DmChannelMemberConfiguration
    : IEntityTypeConfiguration<DmChannelMember>
{
    public void Configure(EntityTypeBuilder<DmChannelMember> builder)
    {
        builder.HasKey(x => new { x.ChannelId, x.UserId });

        builder.Property(x => x.JoinedAt)
            .IsRequired();

        builder.HasOne(x => x.Channel)
            .WithMany(c => c.Members)
            .HasForeignKey(x => x.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}