using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Librecord.Api.Controllers;

public abstract class AuthenticatedController : ControllerBase
{
    protected Guid UserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
