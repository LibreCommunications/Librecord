using System.Text;
using System.Threading.RateLimiting;
using Librecord.Api;
using Librecord.Api.Hubs;
using Librecord.Api.Middleware;
using Librecord.Application;

using Librecord.Domain.Identity;
using Librecord.Domain.Security;
using Librecord.Domain.Voice;
using Librecord.Infra;
using Librecord.Infra.Database;
using Librecord.Infra.Database.Seeders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// --------------------------------------------------
// CONFIG
// --------------------------------------------------
var jwtOpts = builder.Configuration
    .GetSection("Jwt")
    .Get<JwtOptions>()
    ?? throw new InvalidOperationException("JWT configuration is missing. Set Jwt:SigningKey, Jwt:Issuer, Jwt:Audience.");

if (string.IsNullOrWhiteSpace(jwtOpts.SigningKey) || jwtOpts.SigningKey.Length < 32)
    throw new InvalidOperationException("JWT SigningKey must be at least 32 characters.");

if (string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("Default")))
    throw new InvalidOperationException("ConnectionStrings:Default is missing.");

if (string.IsNullOrWhiteSpace(builder.Configuration["Security:MessageEncryptionKey"]))
    throw new InvalidOperationException("Security:MessageEncryptionKey is missing.");

// --------------------------------------------------
// SERVICE REGISTRATION
// --------------------------------------------------
ConfigureIdentity(builder.Services);
ConfigureAuthentication(builder.Services, jwtOpts);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApi(builder.Configuration);

ConfigureDatabase(builder.Services, builder.Configuration);
ConfigureSwagger(builder.Services);
ConfigureRateLimiting(builder.Services);

// --------------------------------------------------
// BUILD APP
// --------------------------------------------------
var app = builder.Build();

// --------------------------------------------------
// MIDDLEWARE PIPELINE
// --------------------------------------------------
if (app.Environment.IsDevelopment())
{
    ConfigureDevelopment(app);
}

app.UseMiddleware<GlobalExceptionHandler>();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapHub<AppHub>("/hubs/app");
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// --------------------------------------------------
// DATABASE MIGRATIONS & SEEDING
// --------------------------------------------------
ApplyMigrations(app);

// Clear stale voice states from previous run
{
    using var scope = app.Services.CreateScope();
    var voiceRepo = scope.ServiceProvider.GetRequiredService<IVoiceStateRepository>();
    await voiceRepo.RemoveAllAsync();
}

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    await UserSeeder.SeedAsync(scope.ServiceProvider);
}

// --------------------------------------------------
await app.RunAsync();


// ==================================================
// CONFIG HELPERS
// ==================================================

static void ConfigureIdentity(IServiceCollection services)
{
    services
        .AddIdentityCore<User>(options =>
        {
            options.User.RequireUniqueEmail = true;
        })
        .AddEntityFrameworkStores<LibrecordContext>()
        .AddDefaultTokenProviders();
}

static void ConfigureAuthentication(
    IServiceCollection services,
    JwtOptions jwtOpts)
{
    var key = Encoding.UTF8.GetBytes(jwtOpts.SigningKey);

    services
        .AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme =
                JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme =
                JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = jwtOpts.Issuer,
                ValidAudience = jwtOpts.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            };

            // Read JWT from HttpOnly cookie
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    ctx.Token =
                        ctx.Request.Cookies["accessToken"];
                    return Task.CompletedTask;
                },

                OnAuthenticationFailed = _ => Task.CompletedTask
            };
        });
}

static void ConfigureDatabase(
    IServiceCollection services,
    IConfiguration config)
{
    services.AddDbContext<LibrecordContext>(options =>
        options.UseNpgsql(
            config.GetConnectionString("Default"),
            npgsql => npgsql.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorCodesToAdd: null)
        ));
}

static void ConfigureSwagger(IServiceCollection services)
{
    services.AddEndpointsApiExplorer();
    services.AddSwaggerGen();
}

static void ConfigureDevelopment(WebApplication app)
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // Dev certs only — HTTPS handled by Nginx in prod
    app.Urls.Add("https://localhost:5111");
    app.UseHttpsRedirection();
}

static void ConfigureRateLimiting(IServiceCollection services)
{
    services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        options.OnRejected = async (context, cancellationToken) =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("RateLimiting");
            logger.LogWarning(
                "Rate limit exceeded | IP={IP} | Path={Path} | Policy={Policy}",
                context.HttpContext.Connection.RemoteIpAddress,
                context.HttpContext.Request.Path,
                context.Lease.TryGetMetadata(System.Threading.RateLimiting.MetadataName.RetryAfter, out var retryAfter)
                    ? $"retry after {retryAfter.TotalSeconds}s" : "n/a");

            context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            await context.HttpContext.Response.WriteAsync("Too many requests. Please try again later.", cancellationToken);
        };

        // Use X-Forwarded-For from Nginx to identify the real client IP,
        // falling back to the connection IP for direct access
        static string GetClientIp(HttpContext ctx)
        {
            var forwarded = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrEmpty(forwarded))
                return forwarded.Split(',')[0].Trim();

            var ip = ctx.Connection.RemoteIpAddress;
            if (ip != null && System.Net.IPAddress.IsLoopback(ip))
                return "loopback";

            return ip?.ToString() ?? "unknown";
        }

        // Global default: 3000 requests per minute per client IP
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            var clientIp = GetClientIp(ctx);
            if (clientIp == "loopback")
                return RateLimitPartition.GetNoLimiter("loopback");

            return RateLimitPartition.GetFixedWindowLimiter(
                clientIp,
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 3000,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
        });

        // Auth endpoints: 60 per minute (brute force protection)
        options.AddPolicy("auth", ctx =>
        {
            var clientIp = GetClientIp(ctx);
            if (clientIp == "loopback")
                return RateLimitPartition.GetNoLimiter("loopback");
            return RateLimitPartition.GetFixedWindowLimiter(
                clientIp,
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 60,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
        });

        // File uploads: 120 per minute
        options.AddPolicy("upload", ctx =>
        {
            var clientIp = GetClientIp(ctx);
            if (clientIp == "loopback")
                return RateLimitPartition.GetNoLimiter("loopback");
            return RateLimitPartition.GetFixedWindowLimiter(
                clientIp,
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
        });
    });
}

static void ApplyMigrations(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider
        .GetRequiredService<LibrecordContext>();

    db.Database.Migrate();
}
