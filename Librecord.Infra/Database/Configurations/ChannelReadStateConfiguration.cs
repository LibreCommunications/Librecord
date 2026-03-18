using Librecord.Domain.Messaging.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class ChannelReadStateConfiguration : IEntityTypeConfiguration<ChannelReadState>
{
    public void Configure(EntityTypeBuilder<ChannelReadState> builder)
    {
        builder.HasKey(r => new { r.UserId, r.ChannelId });

        builder.Property(r => r.LastReadAt)
            .IsRequired();

        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
