using Librecord.Domain.Messaging.Direct;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Librecord.Infra.Database.Configurations;

public class DmChannelConfiguration : IEntityTypeConfiguration<DmChannel>
{
    public void Configure(EntityTypeBuilder<DmChannel> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(64);

        builder.Property(c => c.CreatedAt)
            .IsRequired();
    }
}