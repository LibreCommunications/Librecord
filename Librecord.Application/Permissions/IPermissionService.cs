using Librecord.Application.Models.Results;
using Librecord.Domain.Permissions;

namespace Librecord.Application.Permissions;

public interface IPermissionService
{
    Task<PermissionResult> HasGuildPermissionAsync(
        Guid userId,
        Guid guildId,
        PermissionCapability permission);

    Task<HashSet<PermissionCapability>?> GetGrantedGuildPermissionsAsync(
        Guid userId,
        Guid guildId);

    Task<PermissionResult> HasChannelPermissionAsync(
        Guid userId,
        Guid channelId,
        PermissionCapability permission);

    Task SetChannelOverrideAsync(
        Guid channelId, Guid? roleId, Guid? userId,
        Guid permissionId, bool? allow);
}