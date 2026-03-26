using Librecord.Application.Guilds;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Storage;
using Moq;

namespace Librecord.Tests.Guilds;

public class GuildOwnershipTests
{
    private readonly Mock<IGuildRepository> _guilds = new();
    private readonly Mock<IPermissionService> _permissions = new();
    private readonly Mock<IAttachmentStorageService> _storage = new();

    private GuildService CreateGuildService() => new(_guilds.Object, _permissions.Object);
    private GuildSettingsService CreateSettingsService() => new(_guilds.Object, _storage.Object);

    [Fact]
    public async Task CreateGuild_SetsOwnerId()
    {
        var ownerId = Guid.NewGuid();
        var svc = CreateGuildService();

        var guild = await svc.CreateGuildAsync(ownerId, "Test");

        Assert.Equal(ownerId, guild.OwnerId);
    }

    [Fact]
    public async Task CreateGuild_OwnerIdMatchesMember()
    {
        var ownerId = Guid.NewGuid();
        var svc = CreateGuildService();

        var guild = await svc.CreateGuildAsync(ownerId, "Test");

        Assert.Equal(ownerId, guild.OwnerId);
        Assert.Single(guild.Members);
        Assert.Equal(ownerId, guild.Members[0].UserId);
    }

    [Fact]
    public async Task UpdateGuild_OwnerCanUpdate()
    {
        var ownerId = Guid.NewGuid();
        var guild = new Guild { Id = Guid.NewGuid(), Name = "Old", OwnerId = ownerId };
        _guilds.Setup(g => g.GetGuildAsync(guild.Id)).ReturnsAsync(guild);

        var svc = CreateSettingsService();
        var result = await svc.UpdateGuildAsync(guild.Id, "New Name");

        Assert.NotNull(result);
        Assert.Equal("New Name", result!.Name);
    }

    [Fact]
    public async Task UpdateGuild_NonexistentGuild_ReturnsNull()
    {
        _guilds.Setup(g => g.GetGuildAsync(It.IsAny<Guid>())).ReturnsAsync((Guild?)null);

        var svc = CreateSettingsService();
        var result = await svc.UpdateGuildAsync(Guid.NewGuid(), "New");

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteGuild_ExistingGuild_ReturnsSuccess()
    {
        var guild = new Guild { Id = Guid.NewGuid(), Name = "Test", OwnerId = Guid.NewGuid() };
        _guilds.Setup(g => g.GetGuildAsync(guild.Id)).ReturnsAsync(guild);
        _guilds.Setup(g => g.GetChannelIdsAsync(guild.Id)).ReturnsAsync([Guid.NewGuid()]);

        var svc = CreateSettingsService();
        var (success, channelIds) = await svc.DeleteGuildAsync(guild.Id);

        Assert.True(success);
        Assert.Single(channelIds);
        _guilds.Verify(g => g.RemoveGuildAsync(guild), Times.Once);
    }

    [Fact]
    public async Task DeleteGuild_NonexistentGuild_ReturnsFalse()
    {
        _guilds.Setup(g => g.GetGuildAsync(It.IsAny<Guid>())).ReturnsAsync((Guild?)null);

        var svc = CreateSettingsService();
        var (success, _) = await svc.DeleteGuildAsync(Guid.NewGuid());

        Assert.False(success);
    }

    [Fact]
    public void Guild_OwnerId_DefaultsToEmpty()
    {
        var guild = new Guild { Name = "Test" };
        Assert.Equal(Guid.Empty, guild.OwnerId);
    }
}
