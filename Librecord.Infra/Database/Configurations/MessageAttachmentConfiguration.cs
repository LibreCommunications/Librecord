using Librecord.Domain.Messaging.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class MessageAttachmentConfiguration : IEntityTypeConfiguration<MessageAttachment>
{
    public void Configure(EntityTypeBuilder<MessageAttachment> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.FileName).HasMaxLength(256).IsRequired();
        builder.Property(a => a.Url).IsRequired();
        builder.Property(a => a.ContentType).HasMaxLength(128).IsRequired();

        builder.Property(a => a.CreatedAt).IsRequired();
    }
}