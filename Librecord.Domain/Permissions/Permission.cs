namespace Librecord.Domain.Permissions;

public class Permission
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Type { get; set; } = null!;
}