using Librecord.Domain.Messaging.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class MessageEditConfiguration : IEntityTypeConfiguration<MessageEdit>
{
    public void Configure(EntityTypeBuilder<MessageEdit> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.OldContent)
            .IsRequired();

        builder.Property(e => e.EditedAt)
            .IsRequired();

        builder.HasOne(e => e.Editor)
            .WithMany()
            .HasForeignKey(e => e.EditorUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}