using Librecord.Domain.Permissions;

namespace Librecord.Application.Permissions;

public interface IPermissionRegistry
{
    PermissionCapability Resolve(string name, string type);
}

public sealed class PermissionRegistry : IPermissionRegistry
{
    private readonly Dictionary<(string Name, string Type), PermissionCapability> _map;

    public PermissionRegistry()
    {
        _map = KnownPermissions.All.ToDictionary(
            p => (p.Perm.Key, p.Type),
            p => p.Perm
        );
    }

    public PermissionCapability Resolve(string name, string type)
    {
        if (!_map.TryGetValue((name, type), out var cap))
            throw new InvalidOperationException(
                $"Unknown permission: {type}:{name}"
            );

        return cap;
    }
}