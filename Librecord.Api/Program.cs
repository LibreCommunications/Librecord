using System.Text;
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
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// --------------------------------------------------
// CONFIG
// --------------------------------------------------
var jwtOpts = builder.Configuration
    .GetSection("Jwt")
    .Get<JwtOptions>()!;

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

app.MapControllers();
app.MapHub<DmHub>("/hubs/dms");
app.MapHub<GuildHub>("/hubs/guilds");
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

                OnAuthenticationFailed = ctx =>
                {
                    Console.WriteLine(
                        "JWT ERROR: " + ctx.Exception.Message
                    );
                    return Task.CompletedTask;
                }
            };
        });
}

static void ConfigureDatabase(
    IServiceCollection services,
    IConfiguration config)
{
    services.AddDbContext<LibrecordContext>(options =>
        options.UseNpgsql(
            config.GetConnectionString("Default")
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

static void ApplyMigrations(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider
        .GetRequiredService<LibrecordContext>();

    db.Database.Migrate();
}
