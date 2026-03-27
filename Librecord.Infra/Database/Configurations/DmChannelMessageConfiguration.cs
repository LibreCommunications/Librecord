using Librecord.Domain.Messaging.Direct;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class DmChannelMessageConfiguration
    : IEntityTypeConfiguration<DmChannelMessage>
{
    public void Configure(EntityTypeBuilder<DmChannelMessage> builder)
    {
        builder.HasKey(m => new { m.MessageId, m.ChannelId });

        builder.Property(m => m.EncryptionAlgorithm)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(m => m.EncryptionSalt)
            .IsRequired();

        builder.HasOne(m => m.Message)
            .WithOne(m => m.DmContext)
            .HasForeignKey<DmChannelMessage>(m => m.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Channel)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(m => m.ChannelId);
    }
}