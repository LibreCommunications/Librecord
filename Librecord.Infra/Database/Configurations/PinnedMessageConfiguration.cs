using Librecord.Domain.Messaging.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class PinnedMessageConfiguration : IEntityTypeConfiguration<PinnedMessage>
{
    public void Configure(EntityTypeBuilder<PinnedMessage> builder)
    {
        builder.HasKey(p => new { p.ChannelId, p.MessageId });

        builder.Property(p => p.PinnedAt).IsRequired();

        builder.HasOne(p => p.Message)
            .WithMany()
            .HasForeignKey(p => p.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.PinnedBy)
            .WithMany()
            .HasForeignKey(p => p.PinnedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
