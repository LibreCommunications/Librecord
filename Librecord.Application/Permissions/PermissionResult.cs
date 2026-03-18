namespace Librecord.Application.Permissions;

public class PermissionResult
{
    private PermissionResult(bool allowed, string? error)
    {
        Allowed = allowed;
        Error = error;
    }

    public bool Allowed { get; }
    public string? Error { get; }

    public static PermissionResult Allow()
    {
        return new PermissionResult(true, null);
    }

    public static PermissionResult Deny(string error)
    {
        return new PermissionResult(false, error);
    }
}