namespace Librecord.Api.Models.Auth;

public class FriendDto
{
    public bool Success { get; set; }
    public string? Error { get; set; }

    public Guid? FriendshipId { get; set; }
    public Guid? RequesterId { get; set; }
    public Guid? TargetId { get; set; }
    public string? Status { get; set; }
}