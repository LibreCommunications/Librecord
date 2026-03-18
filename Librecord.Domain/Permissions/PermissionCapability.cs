namespace Librecord.Domain.Permissions;

public abstract class PermissionCapability : IEquatable<PermissionCapability>
{
    protected PermissionCapability(string key)
    {
        Key = key;
    }

    public string Key { get; }

    public bool Equals(PermissionCapability? other)
    {
        return other is not null && Key == other.Key;
    }

    public override bool Equals(object? obj)
    {
        return obj is PermissionCapability p && Equals(p);
    }

    public override int GetHashCode()
    {
        return Key.GetHashCode();
    }

    public override string ToString()
    {
        return Key;
    }
}