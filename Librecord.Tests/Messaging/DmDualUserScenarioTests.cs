using Librecord.Application.Messaging;
using Librecord.Application.Realtime.DMs;
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
/// channel creation → messaging between two users → edits → deletes → blocks.
/// Each test sets up both users and verifies cross-user behaviour.
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

    private DirectMessageService CreateMessageService() =>
        new(_messages.Object, _channels.Object, _realtime.Object, _blocks.Object);

    private DirectMessageChannelService CreateChannelService() =>
        new(_channels.Object, _friendships.Object, _blocks.Object, _storage.Object, _readStates.Object,
            Mock.Of<ILogger<DirectMessageChannelService>>());

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
    // TWO USERS EXCHANGE MESSAGES
    // ---------------------------------------------------------

    [Fact]
    public async Task TwoUsers_BothCanSendMessages_EachGetsCreatedEvent()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId, "msg", "alice"));

        var svc = CreateMessageService();

        // Alice sends
        await svc.SendMessageAsync(channelId, alice, "Hello Bob!", "client-1");

        // Now Bob sends (re-setup the mock to return Bob as author)
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, bob, channelId, "msg", "bob"));

        await svc.SendMessageAsync(channelId, bob, "Hello Alice!", "client-2");

        // Verify both messages triggered events
        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageCreated>(e =>
            e.ChannelId == channelId && e.ClientMessageId == "client-1"
        )), Times.Once);

        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageCreated>(e =>
            e.ChannelId == channelId && e.ClientMessageId == "client-2"
        )), Times.Once);

        // Two messages persisted
        _messages.Verify(m => m.AddMessageAsync(It.IsAny<Message>(), channelId), Times.Exactly(2));
    }

    // ---------------------------------------------------------
    // USER CANNOT EDIT OTHER USER'S MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task UserA_CannotEdit_UserB_Message()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var messageId = Guid.NewGuid();

        // Bob's message
        var bobMessage = MakeHydratedMessage(messageId, bob, channelId, "bob's message", "bob");
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(bobMessage);

        var svc = CreateMessageService();

        // Alice tries to edit Bob's message
        var result = await svc.EditMessageAsync(messageId, alice, "hacked by alice");

        Assert.Null(result);
        _messages.Verify(m => m.UpdateMessageAsync(It.IsAny<Message>()), Times.Never);
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEvent>()), Times.Never);
    }

    // ---------------------------------------------------------
    // USER CANNOT DELETE OTHER USER'S MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task UserA_CannotDelete_UserB_Message()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var messageId = Guid.NewGuid();

        var bobMessage = MakeHydratedMessage(messageId, bob, channelId, "bob's msg", "bob");
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(bobMessage);

        var svc = CreateMessageService();
        var result = await svc.DeleteMessageAsync(messageId, alice);

        Assert.False(result);
        _messages.Verify(m => m.DeleteMessageAsync(It.IsAny<Guid>()), Times.Never);
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEvent>()), Times.Never);
    }

    // ---------------------------------------------------------
    // BLOCK PREVENTS MESSAGING
    // ---------------------------------------------------------

    [Fact]
    public async Task Alice_BlocksBob_BobCannotSendMessage()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        // Alice blocked Bob (bidirectional check returns true)
        _blocks.Setup(b => b.IsEitherBlockedAsync(bob, alice)).ReturnsAsync(true);

        var svc = CreateMessageService();

        // Bob tries to send
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync(channelId, bob, "can you see this?"));

        Assert.Contains("Cannot send", ex.Message);
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEvent>()), Times.Never);
    }

    [Fact]
    public async Task Alice_BlocksBob_AliceAlsoCannotSendMessage()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        // Bidirectional block — both directions return true
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateMessageService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync(channelId, alice, "hello?"));
    }

    // ---------------------------------------------------------
    // BLOCK PREVENTS STARTING DM
    // ---------------------------------------------------------

    [Fact]
    public async Task BlockedUser_CannotStartDm()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();

        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateChannelService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.StartDmAsync(alice, bob));

        Assert.Contains("Cannot start", ex.Message);
        _channels.Verify(d => d.AddChannelAsync(It.IsAny<DmChannel>()), Times.Never);
    }

    // ---------------------------------------------------------
    // BLOCK PREVENTS ADDING PARTICIPANT
    // ---------------------------------------------------------

    [Fact]
    public async Task BlockedUser_CannotBeAddedToGroupDm()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, Guid.NewGuid());

        _channels.Setup(d => d.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateChannelService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AddParticipantAsync(channelId, alice, bob));

        Assert.Contains("Cannot add", ex.Message);
    }

    // ---------------------------------------------------------
    // GROUP DM: THREE USERS
    // ---------------------------------------------------------

    [Fact]
    public async Task GroupDm_AllMembersCanSend()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var charlie = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob, charlie);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId));

        var svc = CreateMessageService();

        // All three should be able to send (no block check in group DMs)
        await svc.SendMessageAsync(channelId, alice, "hello from alice");

        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, bob, channelId, "msg", "bob"));
        await svc.SendMessageAsync(channelId, bob, "hello from bob");

        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, charlie, channelId, "msg", "charlie"));
        await svc.SendMessageAsync(channelId, charlie, "hello from charlie");

        _messages.Verify(m => m.AddMessageAsync(It.IsAny<Message>(), channelId), Times.Exactly(3));
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageCreated>()), Times.Exactly(3));
    }

    [Fact]
    public async Task GroupDm_BlockDoesNotPreventMessaging()
    {
        // In group DMs (3+ members), block check is skipped
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var charlie = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob, charlie);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        // Alice blocked Bob, but it's a group DM
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId));

        var svc = CreateMessageService();

        // Alice can still send in the group DM
        var result = await svc.SendMessageAsync(channelId, alice, "group message");

        Assert.NotNull(result);
    }

    // ---------------------------------------------------------
    // CHANNEL LIFECYCLE: CREATE → MESSAGE → LEAVE
    // ---------------------------------------------------------

    [Fact]
    public async Task ChannelLifecycle_StartDm_SendMessages_Leave()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        // Step 1: Start DM (returns new channel)
        _channels.Setup(d => d.GetUserDmChannelsAsync(alice)).ReturnsAsync([]);

        DmChannel? capturedChannel = null;
        _channels.Setup(d => d.AddChannelAsync(It.IsAny<DmChannel>()))
            .Callback<DmChannel>(c => capturedChannel = c)
            .Returns(Task.CompletedTask);

        var channelSvc = CreateChannelService();
        var newChannel = await channelSvc.StartDmAsync(alice, bob);

        Assert.NotNull(newChannel);
        Assert.Equal(2, newChannel.Members.Count);
        _channels.Verify(d => d.AddChannelAsync(It.IsAny<DmChannel>()), Times.Once);
        _channels.Verify(d => d.SaveChangesAsync(), Times.Once);

        // Step 2: Send a message in the channel
        var ch = MakeChannel(newChannel.Id, alice, bob);
        _channels.Setup(c => c.GetChannelAsync(newChannel.Id)).ReturnsAsync(ch);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, newChannel.Id));

        var msgSvc = CreateMessageService();
        var msg = await msgSvc.SendMessageAsync(newChannel.Id, alice, "first message!");

        Assert.NotNull(msg);
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageCreated>()), Times.Once);

        // Step 3: Bob leaves (only group DMs can be left)
        ch.IsGroup = true;
        _channels.Setup(c => c.GetChannelAsync(newChannel.Id)).ReturnsAsync(ch);
        await channelSvc.LeaveChannelAsync(newChannel.Id, bob);

        Assert.Single(ch.Members);
        Assert.DoesNotContain(ch.Members, m => m.UserId == bob);
    }

    // ---------------------------------------------------------
    // SEND REQUEST WHILE BLOCKED
    // ---------------------------------------------------------

    [Fact]
    public async Task SendFriendRequest_WhileBlocked_Fails()
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
    // CONCURRENT-LIKE: ALICE EDITS WHILE BOB DELETES DIFFERENT MSG
    // ---------------------------------------------------------

    [Fact]
    public async Task AliceEdits_BobDeletesOwnMessage_BothSucceed()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        var aliceMsg = MakeHydratedMessage(Guid.NewGuid(), alice, channelId, "alice's msg", "alice");
        var bobMsg = MakeHydratedMessage(Guid.NewGuid(), bob, channelId, "bob's msg", "bob");

        _messages.Setup(m => m.GetMessageAsync(aliceMsg.Id)).ReturnsAsync(aliceMsg);
        _messages.Setup(m => m.GetMessageAsync(bobMsg.Id)).ReturnsAsync(bobMsg);

        var svc = CreateMessageService();

        // Alice edits her message
        var edited = await svc.EditMessageAsync(aliceMsg.Id, alice, "alice's updated msg");
        Assert.NotNull(edited);
        Assert.Equal("alice's updated msg", edited.ContentText);

        // Bob deletes his message
        var deleted = await svc.DeleteMessageAsync(bobMsg.Id, bob);
        Assert.True(deleted);

        // Both events were emitted
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEdited>()), Times.Once);
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageDeleted>()), Times.Once);
    }
}
