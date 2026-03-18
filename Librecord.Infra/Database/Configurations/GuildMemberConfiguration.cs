using Librecord.Domain.Guilds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

internal class GuildMemberConfiguration : IEntityTypeConfiguration<GuildMember>
{
    public void Configure(EntityTypeBuilder<GuildMember> builder)
    {
        builder.HasKey(m => new { m.GuildId, m.UserId });

        builder.Property(m => m.JoinedAt)
            .IsRequired();
        
        builder.HasOne(m => m.User)
            .WithMany(u => u.GuildMemberships)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Guild)
            .WithMany(g => g.Members)
            .HasForeignKey(m => m.GuildId)
            .OnDelete(DeleteBehavior.Cascade);

    }
}