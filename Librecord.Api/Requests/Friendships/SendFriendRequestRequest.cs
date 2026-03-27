using System.ComponentModel.DataAnnotations;

namespace Librecord.Api.Requests;

public sealed class SendFriendRequestRequest
{
    [Required, MaxLength(32)]
    public string Username { get; init; } = "";
}
