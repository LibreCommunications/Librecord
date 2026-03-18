using Librecord.Domain.Voice;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class VoiceStateConfiguration : IEntityTypeConfiguration<VoiceState>
{
    public void Configure(EntityTypeBuilder<VoiceState> builder)
    {
        builder.HasKey(v => v.UserId);

        builder.Property(v => v.ChannelId)
            .IsRequired();

        builder.Property(v => v.GuildId)
            .IsRequired();

        builder.Property(v => v.JoinedAt)
            .IsRequired();

        builder.HasIndex(v => v.ChannelId);
    }
}
