using Librecord.Application.Models.Results;
using Librecord.Domain.Permissions;

namespace Librecord.Application.Permissions;

public interface IPermissionService
{
    Task<PermissionResult> HasGuildPermissionAsync(
        Guid userId,
        Guid guildId,
        PermissionCapability permission);

    Task<PermissionResult> HasChannelPermissionAsync(
        Guid userId,
        Guid channelId,
        PermissionCapability permission);
}