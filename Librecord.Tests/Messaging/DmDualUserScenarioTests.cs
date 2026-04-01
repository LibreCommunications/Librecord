using Librecord.Application.Messaging;
using Librecord.Application.Realtime.DMs;
using Librecord.Domain;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;
using Librecord.Domain.Storage;
using Microsoft.Extensions.Logging;
using Moq;

namespace Librecord.Tests.Messaging;

/// <summary>
/// End-to-end dual-user DM scenarios that verify the full lifecycle:
/// channel creation, messaging between two users, edits, deletes, and blocks.
/// </summary>
public class DmDualUserScenarioTests
{
    private readonly Mock<IDirectMessageRepository> _messages = new();
    private readonly Mock<IDirectMessageChannelRepository> _channels = new();
    private readonly Mock<IDmRealtimeNotifier> _realtime = new();
    private readonly Mock<IBlockRepository> _blocks = new();
    private readonly Mock<IFriendshipRepository> _friendships = new();
    private readonly Mock<IAttachmentStorageService> _storage = new();
    private readonly Mock<IReadStateRepository> _readStates = new();

    private static Mock<IUnitOfWork> MockUow()
    {
        var uow = new Mock<IUnitOfWork>();
        uow.Setup(u => u.ExecuteInTransactionAsync(It.IsAny<Func<Task>>()))
            .Returns((Func<Task> action) => action());
        uow.Setup(u => u.SaveChangesAsync()).Returns(Task.CompletedTask);
        return uow;
    }

    private DirectMessageService CreateMessageService() =>
        new(_messages.Object, _channels.Object, _realtime.Object, _blocks.Object);

    private DirectMessageChannelService CreateChannelService() =>
        new(_channels.Object, _friendships.Object, _blocks.Object, _storage.Object, _readStates.Object,
            MockUow().Object, Mock.Of<ILogger<DirectMessageChannelService>>());

    private static User MakeUser(Guid id, string name) => new()
    {
        Id = id,
        UserName = name,
        DisplayName = name
    };

    private static DmChannel MakeChannel(Guid channelId, params Guid[] memberIds)
    {
        var channel = new DmChannel { Id = channelId };
        foreach (var uid in memberIds)
            channel.Members.Add(new DmChannelMember { ChannelId = channelId, UserId = uid });
        return channel;
    }

    private static Message MakeHydratedMessage(
        Guid id, Guid userId, Guid channelId,
        string content = "hello", string username = "user")
    {
        return new Message
        {
            Id = id,
            UserId = userId,
            ContentText = content,
            CreatedAt = DateTime.UtcNow,
            User = MakeUser(userId, username),
            DmContext = new DmChannelMessage
            {
                MessageId = id,
                ChannelId = channelId,
                EncryptionSalt = [],
                EncryptionAlgorithm = "AES-GCM"
            }
        };
    }

    // ---------------------------------------------------------
    // USER A SENDS TO USER B
    // ---------------------------------------------------------

    [Fact]
    public async Task When_UserASendsToUserB_Should_UserBSeeTheMessage()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId, "Hello Bob!", "alice"));

        var svc = CreateMessageService();

        // Alice sends
        await svc.SendMessageAsync(channelId, alice, "Hello Bob!", "client-1");

        // Bob sends
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, bob, channelId, "Hello Alice!", "bob"));
        await svc.SendMessageAsync(channelId, bob, "Hello Alice!", "client-2");

        // Both messages triggered real-time events (both users see them)
        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageCreated>(e =>
            e.ChannelId == channelId && e.ClientMessageId == "client-1"
        )), Times.Once);
        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageCreated>(e =>
            e.ChannelId == channelId && e.ClientMessageId == "client-2"
        )), Times.Once);
        _messages.Verify(m => m.AddMessageAsync(It.IsAny<Message>(), channelId), Times.Exactly(2));
    }

    // ---------------------------------------------------------
    // BLOCK PREVENTS MESSAGING
    // ---------------------------------------------------------

    [Fact]
    public async Task When_UserABlocksUserB_Should_UserBNotBeAbleToSend()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _blocks.Setup(b => b.IsEitherBlockedAsync(bob, alice)).ReturnsAsync(true);

        var svc = CreateMessageService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync(channelId, bob, "can you see this?"));
        Assert.Contains("Cannot send", ex.Message);
    }

    [Fact]
    public async Task When_UserABlocksUserB_Should_UserAAlsoNotBeAbleToSend()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateMessageService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync(channelId, alice, "hello?"));
    }

    [Fact]
    public async Task When_BlockedUserTriesToStartDm_Should_Reject()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateChannelService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.StartDmAsync(alice, bob));
        Assert.Contains("Cannot start", ex.Message);
    }

    // ---------------------------------------------------------
    // EDITING — ONLY AUTHOR SHOULD SUCCEED
    // ---------------------------------------------------------

    [Fact]
    public async Task When_EditingOwnMessage_Should_AuthorSucceed()
    {
        var alice = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var aliceMsg = MakeHydratedMessage(Guid.NewGuid(), alice, channelId, "original", "alice");

        _messages.Setup(m => m.GetMessageAsync(aliceMsg.Id)).ReturnsAsync(aliceMsg);

        var svc = CreateMessageService();
        var edited = await svc.EditMessageAsync(aliceMsg.Id, alice, "updated");

        Assert.NotNull(edited);
        Assert.Equal("updated", edited.ContentText);
    }

    [Fact]
    public async Task When_EditingOtherUsersMessage_Should_Reject()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var bobMsg = MakeHydratedMessage(Guid.NewGuid(), bob, channelId, "bob's message", "bob");

        _messages.Setup(m => m.GetMessageAsync(bobMsg.Id)).ReturnsAsync(bobMsg);

        var svc = CreateMessageService();
        var result = await svc.EditMessageAsync(bobMsg.Id, alice, "hacked by alice");

        Assert.Null(result);
    }

    // ---------------------------------------------------------
    // DELETING — ONLY AUTHOR SHOULD SUCCEED
    // ---------------------------------------------------------

    [Fact]
    public async Task When_DeletingOtherUsersMessage_Should_Reject()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var bobMsg = MakeHydratedMessage(Guid.NewGuid(), bob, channelId, "bob's msg", "bob");

        _messages.Setup(m => m.GetMessageAsync(bobMsg.Id)).ReturnsAsync(bobMsg);

        var svc = CreateMessageService();
        var result = await svc.DeleteMessageAsync(bobMsg.Id, alice);

        Assert.False(result);
    }

    // ---------------------------------------------------------
    // CONCURRENT EDIT + DELETE ON DIFFERENT MESSAGES
    // ---------------------------------------------------------

    [Fact]
    public async Task When_AliceEditsAndBobDeletesDifferentMessages_Should_BothSucceed()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        var aliceMsg = MakeHydratedMessage(Guid.NewGuid(), alice, channelId, "alice's msg", "alice");
        var bobMsg = MakeHydratedMessage(Guid.NewGuid(), bob, channelId, "bob's msg", "bob");

        _messages.Setup(m => m.GetMessageAsync(aliceMsg.Id)).ReturnsAsync(aliceMsg);
        _messages.Setup(m => m.GetMessageAsync(bobMsg.Id)).ReturnsAsync(bobMsg);

        var svc = CreateMessageService();

        var edited = await svc.EditMessageAsync(aliceMsg.Id, alice, "alice's updated msg");
        Assert.NotNull(edited);
        Assert.Equal("alice's updated msg", edited.ContentText);

        var deleted = await svc.DeleteMessageAsync(bobMsg.Id, bob);
        Assert.True(deleted);

        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEdited>()), Times.Once);
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageDeleted>()), Times.Once);
    }

    // ---------------------------------------------------------
    // GROUP DM: BLOCK DOES NOT PREVENT MESSAGING
    // ---------------------------------------------------------

    [Fact]
    public async Task When_SendingInGroupDmWithBlockedUser_Should_Succeed()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var charlie = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob, charlie);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId));

        var svc = CreateMessageService();
        var result = await svc.SendMessageAsync(channelId, alice, "group message");

        Assert.NotNull(result);
    }
}
