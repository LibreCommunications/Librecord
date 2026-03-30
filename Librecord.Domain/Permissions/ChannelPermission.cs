namespace Librecord.Domain.Permissions;

public abstract class ChannelPermission : PermissionCapability
{
    public static readonly ChannelPermission ViewChannel =
        new Impl("ViewChannel");

    public static readonly ChannelPermission ReadMessages =
        new Impl("ReadMessages");

    public static readonly ChannelPermission SendMessages =
        new Impl("SendMessages");

    public static readonly ChannelPermission SendAttachments =
        new Impl("SendAttachments");

    public static readonly ChannelPermission AddReactions =
        new Impl("AddReactions");

    public static readonly ChannelPermission ManageMessages =
        new Impl("ManageMessages");

    protected ChannelPermission(string key) : base(key)
    {
    }

    private sealed class Impl : ChannelPermission
    {
        public Impl(string key) : base(key)
        {
        }
    }
}