using System.Security.Cryptography;
using Librecord.Domain.Guilds;

namespace Librecord.Application.Guilds;

public class GuildInviteService : IGuildInviteService
{
    private readonly IGuildInviteRepository _invites;
    private readonly IGuildRepository _guilds;

    public GuildInviteService(
        IGuildInviteRepository invites,
        IGuildRepository guilds)
    {
        _invites = invites;
        _guilds = guilds;
    }

    // ---------------------------------------------------------
    // CREATE INVITE
    // ---------------------------------------------------------
    public async Task<GuildInvite> CreateInviteAsync(
        Guid guildId,
        Guid creatorId,
        int? maxUses = null,
        TimeSpan? expiresIn = null)
    {
        var guild = await _guilds.GetGuildAsync(guildId)
            ?? throw new InvalidOperationException("Guild not found.");

        var member = await _guilds.GetGuildMemberAsync(guildId, creatorId)
            ?? throw new UnauthorizedAccessException("Not a guild member.");

        var invite = new GuildInvite
        {
            Id = Guid.NewGuid(),
            Code = GenerateCode(),
            GuildId = guildId,
            CreatorId = creatorId,
            MaxUses = maxUses,
            ExpiresAt = DateTime.UtcNow.Add(expiresIn ?? TimeSpan.FromDays(7)),
            CreatedAt = DateTime.UtcNow
        };

        await _invites.AddAsync(invite);
        await _invites.SaveChangesAsync();

        return (await _invites.GetByIdAsync(invite.Id))!;
    }

    // ---------------------------------------------------------
    // LIST INVITES
    // ---------------------------------------------------------
    public Task<List<GuildInvite>> GetGuildInvitesAsync(Guid guildId)
    {
        return _invites.GetByGuildIdAsync(guildId);
    }

    // ---------------------------------------------------------
    // GET BY CODE
    // ---------------------------------------------------------
    public Task<GuildInvite?> GetByCodeAsync(string code)
    {
        return _invites.GetByCodeAsync(code);
    }

    // ---------------------------------------------------------
    // JOIN BY INVITE CODE
    // ---------------------------------------------------------
    public async Task<Guild> JoinByCodeAsync(string code, Guid userId)
    {
        var invite = await _invites.GetByCodeAsync(code)
            ?? throw new InvalidOperationException("Invalid invite code.");

        if (invite.ExpiresAt.HasValue && invite.ExpiresAt.Value < DateTime.UtcNow)
            throw new InvalidOperationException("Invite has expired.");

        if (invite.MaxUses.HasValue && invite.UsesCount >= invite.MaxUses.Value)
            throw new InvalidOperationException("Invite has reached max uses.");

        var existing = await _guilds.GetGuildMemberAsync(invite.GuildId, userId);
        if (existing != null)
            throw new InvalidOperationException("Already a member of this guild.");

        var guild = await _guilds.GetGuildAsync(invite.GuildId)
            ?? throw new InvalidOperationException("Guild not found.");

        guild.Members.Add(new GuildMember
        {
            UserId = userId,
            GuildId = guild.Id,
            JoinedAt = DateTime.UtcNow
        });

        invite.UsesCount++;

        await _guilds.SaveChangesAsync();

        return guild;
    }

    // ---------------------------------------------------------
    // REVOKE INVITE
    // ---------------------------------------------------------
    public async Task RevokeInviteAsync(Guid inviteId, Guid userId)
    {
        var invite = await _invites.GetByIdAsync(inviteId)
            ?? throw new InvalidOperationException("Invite not found.");

        var member = await _guilds.GetGuildMemberAsync(invite.GuildId, userId)
            ?? throw new UnauthorizedAccessException("Not a guild member.");

        await _invites.DeleteAsync(inviteId);
        await _invites.SaveChangesAsync();
    }

    // ---------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------
    private static string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        return string.Create(8, chars, (span, c) =>
        {
            Span<byte> randomBytes = stackalloc byte[span.Length];
            RandomNumberGenerator.Fill(randomBytes);
            for (var i = 0; i < span.Length; i++)
                span[i] = c[randomBytes[i] % c.Length];
        });
    }
}
