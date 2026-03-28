using System.Security.Cryptography;
using Librecord.Domain;
using Librecord.Domain.Guilds;

namespace Librecord.Application.Guilds;

public class GuildInviteService : IGuildInviteService
{
    private readonly IGuildInviteRepository _invites;
    private readonly IGuildRepository _guilds;
    private readonly IUnitOfWork _uow;

    public GuildInviteService(
        IGuildInviteRepository invites,
        IGuildRepository guilds,
        IUnitOfWork uow)
    {
        _invites = invites;
        _guilds = guilds;
        _uow = uow;
    }

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

    public Task<List<GuildInvite>> GetGuildInvitesAsync(Guid guildId)
    {
        return _invites.GetByGuildIdAsync(guildId);
    }

    public Task<GuildInvite?> GetByCodeAsync(string code)
    {
        return _invites.GetByCodeAsync(code);
    }

    public async Task<Guild> JoinByCodeAsync(string code, Guid userId)
    {
        Guild? guild = null;

        await _uow.ExecuteInTransactionAsync(async () =>
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

            guild = await _guilds.GetGuildAsync(invite.GuildId)
                ?? throw new InvalidOperationException("Guild not found.");

            var everyoneRole = guild.Roles.FirstOrDefault(r => r.Name == "@everyone")
                ?? throw new InvalidOperationException("Guild is missing @everyone role.");

            guild.Members.Add(new GuildMember
            {
                UserId = userId,
                GuildId = guild.Id,
                JoinedAt = DateTime.UtcNow,
                Roles =
                {
                    new GuildMemberRole
                    {
                        UserId = userId,
                        GuildId = guild.Id,
                        RoleId = everyoneRole.Id
                    }
                }
            });

            invite.UsesCount++;
        });

        return guild!;
    }

    public async Task RevokeInviteAsync(Guid inviteId, Guid userId)
    {
        var invite = await _invites.GetByIdAsync(inviteId)
            ?? throw new InvalidOperationException("Invite not found.");

        var member = await _guilds.GetGuildMemberAsync(invite.GuildId, userId)
            ?? throw new UnauthorizedAccessException("Not a guild member.");

        await _invites.DeleteAsync(inviteId);
        await _invites.SaveChangesAsync();
    }

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
