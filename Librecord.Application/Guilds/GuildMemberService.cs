using Librecord.Domain.Guilds;

namespace Librecord.Application.Guilds;

public class GuildMemberService : IGuildMemberService
{
    private readonly IGuildRepository _guilds;

    public GuildMemberService(IGuildRepository guilds)
    {
        _guilds = guilds;
    }

    public async Task<bool> KickMemberAsync(Guid guildId, Guid userId)
    {
        var member = await _guilds.GetGuildMemberAsync(guildId, userId);
        if (member == null) return false;

        await _guilds.RemoveMemberAsync(member);
        await _guilds.SaveChangesAsync();
        return true;
    }

    public async Task BanMemberAsync(Guid guildId, Guid userId, Guid moderatorId, string? reason)
    {
        var existingBan = await _guilds.GetBanAsync(guildId, userId);
        if (existingBan != null) return;

        var member = await _guilds.GetGuildMemberAsync(guildId, userId);
        if (member != null)
            await _guilds.RemoveMemberAsync(member);

        await _guilds.AddBanAsync(new GuildBan
        {
            GuildId = guildId,
            UserId = userId,
            ModeratorId = moderatorId,
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        });

        await _guilds.SaveChangesAsync();
    }

    public async Task<bool> UnbanMemberAsync(Guid guildId, Guid userId)
    {
        var ban = await _guilds.GetBanAsync(guildId, userId);
        if (ban == null) return false;

        await _guilds.RemoveBanAsync(ban);
        await _guilds.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<GuildBan>> GetBansAsync(Guid guildId)
    {
        return await _guilds.GetBansAsync(guildId);
    }
}
