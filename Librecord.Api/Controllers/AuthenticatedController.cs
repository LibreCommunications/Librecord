using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

/// <summary>
/// Base controller that provides the authenticated user's ID.
/// </summary>
public abstract class AuthenticatedController : ControllerBase
{
    protected Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
