using Librecord.Application.Guilds;
using Librecord.Application.Permissions;
using Librecord.Domain.Guilds;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Storage;
using Microsoft.Extensions.Logging;
using Moq;

namespace Librecord.Tests.Guilds;

public class GuildOwnershipTests
{
    private readonly Mock<IGuildRepository> _guilds = new();
    private readonly Mock<IPermissionService> _permissions = new();
    private readonly Mock<IAttachmentStorageService> _storage = new();
    private readonly Mock<IAttachmentRepository> _attachments = new();

    private GuildService CreateGuildService() => new(_guilds.Object, _permissions.Object);
    private GuildSettingsService CreateSettingsService() => new(_guilds.Object, _storage.Object, _attachments.Object, Mock.Of<ILogger<GuildSettingsService>>());

    // ---------------------------------------------------------
    // OWNERSHIP
    // ---------------------------------------------------------

    [Fact]
    public async Task When_GuildCreated_Should_SetOwner()
    {
        var ownerId = Guid.NewGuid();
        var svc = CreateGuildService();

        var guild = await svc.CreateGuildAsync(ownerId, "Test");

        Assert.Equal(ownerId, guild.OwnerId);
        Assert.Single(guild.Members);
        Assert.Equal(ownerId, guild.Members[0].UserId);
    }

    // ---------------------------------------------------------
    // UPDATE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_UpdatingGuildSettings_Should_PersistChanges()
    {
        var ownerId = Guid.NewGuid();
        var guild = new Guild { Id = Guid.NewGuid(), Name = "Old", OwnerId = ownerId };
        _guilds.Setup(g => g.GetGuildAsync(guild.Id)).ReturnsAsync(guild);

        var svc = CreateSettingsService();
        var result = await svc.UpdateGuildAsync(guild.Id, "New Name");

        Assert.NotNull(result);
        Assert.Equal("New Name", result!.Name);
        _guilds.Verify(g => g.SaveChangesAsync(), Times.Once);
    }

    // ---------------------------------------------------------
    // DELETE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_DeletingGuild_Should_RemoveIt()
    {
        var guild = new Guild { Id = Guid.NewGuid(), Name = "Test", OwnerId = Guid.NewGuid() };
        _guilds.Setup(g => g.GetGuildAsync(guild.Id)).ReturnsAsync(guild);
        _guilds.Setup(g => g.GetChannelIdsAsync(guild.Id)).ReturnsAsync([Guid.NewGuid()]);
        _attachments.Setup(a => a.GetUrlsByGuildAsync(guild.Id)).ReturnsAsync([]);

        var svc = CreateSettingsService();
        var (success, channelIds) = await svc.DeleteGuildAsync(guild.Id);

        Assert.True(success);
        Assert.Single(channelIds);
        _guilds.Verify(g => g.RemoveGuildAsync(guild), Times.Once);
    }
}
