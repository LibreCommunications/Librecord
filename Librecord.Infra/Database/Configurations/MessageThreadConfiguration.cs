using Librecord.Domain.Messaging.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class MessageThreadConfiguration : IEntityTypeConfiguration<MessageThread>
{
    public void Configure(EntityTypeBuilder<MessageThread> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(t => t.CreatedAt).IsRequired();

        builder.HasOne(t => t.ParentMessage)
            .WithMany()
            .HasForeignKey(t => t.ParentMessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Creator)
            .WithMany()
            .HasForeignKey(t => t.CreatorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(t => t.ChannelId);
    }
}

public class ThreadMessageConfiguration : IEntityTypeConfiguration<ThreadMessage>
{
    public void Configure(EntityTypeBuilder<ThreadMessage> builder)
    {
        builder.HasKey(tm => new { tm.ThreadId, tm.MessageId });

        builder.HasOne(tm => tm.Thread)
            .WithMany()
            .HasForeignKey(tm => tm.ThreadId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tm => tm.Message)
            .WithMany()
            .HasForeignKey(tm => tm.MessageId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
