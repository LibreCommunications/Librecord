using Librecord.Domain.Identity;

namespace Librecord.Application.Models.Results;

public class UserInfoResult
{
    public bool Success { get; private set; }
    public string? Error { get; private set; }

    public Guid UserId { get; private set; }
    public string Username { get; private set; } = "";
    public string DisplayName { get; private set; } = "";
    public string Email { get; private set; } = "";
    public string? AvatarUrl { get; private set; }

    public List<GuildSummary> Guilds { get; private set; } = [];

    public static UserInfoResult Fail(string error)
    {
        return new UserInfoResult { Success = false, Error = error };
    }

    public static UserInfoResult FromUser(User user)
    {
        return new UserInfoResult
        {
            Success = true,
            UserId = user.Id,
            Username = user.UserName ?? "",
            DisplayName = user.DisplayName,
            Email = user.Email ?? "",
            AvatarUrl = user.AvatarUrl,

            Guilds = user.GuildMemberships
                .Select(gm => new GuildSummary(
                    gm.GuildId,
                    gm.Guild.Name,
                    gm.Guild.IconUrl
                ))
                .ToList()
        };
    }
}

public record GuildSummary(Guid GuildId, string Name, string? IconUrl);