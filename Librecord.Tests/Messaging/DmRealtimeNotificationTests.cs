using Librecord.Application.Messaging;
using Librecord.Application.Realtime.DMs;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;
using Moq;

namespace Librecord.Tests.Messaging;

/// <summary>
/// Tests that verify real-time event broadcast behaviour for DM operations.
/// </summary>
public class DmRealtimeNotificationTests
{
    private readonly Mock<IDirectMessageRepository> _messages = new();
    private readonly Mock<IDirectMessageChannelRepository> _channels = new();
    private readonly Mock<IDmRealtimeNotifier> _realtime = new();
    private readonly Mock<IBlockRepository> _blocks = new();

    private DirectMessageService CreateService() =>
        new(_messages.Object, _channels.Object, _realtime.Object, _blocks.Object);

    private static User MakeUser(Guid id, string name = "alice") => new()
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
        string content = "hello", string username = "alice")
    {
        var user = MakeUser(userId, username);
        return new Message
        {
            Id = id,
            UserId = userId,
            ContentText = content,
            CreatedAt = DateTime.UtcNow,
            User = user,
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
    // MESSAGE SENT — BROADCAST TO CHANNEL GROUP
    // ---------------------------------------------------------

    [Fact]
    public async Task When_MessageSent_Should_BroadcastToChannelGroup()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId, "hi there", "alice"));

        var svc = CreateService();
        await svc.SendMessageAsync(channelId, alice, "hi there", "client-99");

        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageCreated>(e =>
            e.ChannelId == channelId &&
            e.AuthorId == alice &&
            e.Content == "hi there" &&
            e.ClientMessageId == "client-99" &&
            e.Author.Username == "alice"
        )), Times.Once);
    }

    [Fact]
    public async Task When_MessageSentWithoutClientId_Should_BroadcastWithNullClientId()
    {
        var alice = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, Guid.NewGuid());

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId));

        var svc = CreateService();
        await svc.SendMessageAsync(channelId, alice, "test");

        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageCreated>(e =>
            e.ClientMessageId == null
        )), Times.Once);
    }

    [Fact]
    public async Task When_SendFails_Should_NotBroadcast()
    {
        _channels.Setup(c => c.GetChannelAsync(It.IsAny<Guid>())).ReturnsAsync((DmChannel?)null);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync(Guid.NewGuid(), Guid.NewGuid(), "hi"));

        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEvent>()), Times.Never);
    }

    // ---------------------------------------------------------
    // MESSAGE EDITED — BROADCAST EDIT EVENT
    // ---------------------------------------------------------

    [Fact]
    public async Task When_MessageEdited_Should_BroadcastEditEvent()
    {
        var alice = Guid.NewGuid();
        var messageId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, alice, channelId);

        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        await svc.EditMessageAsync(messageId, alice, "updated text");

        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageEdited>(e =>
            e.ChannelId == channelId &&
            e.MessageId == messageId &&
            e.Content == "updated text" &&
            e.EditedAt != null
        )), Times.Once);
    }

    [Fact]
    public async Task When_EditFailsDueToWrongAuthor_Should_NotBroadcast()
    {
        var messageId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, Guid.NewGuid(), Guid.NewGuid());
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        await svc.EditMessageAsync(messageId, Guid.NewGuid(), "hacked");

        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEvent>()), Times.Never);
    }

    // ---------------------------------------------------------
    // MESSAGE DELETED — BROADCAST DELETE EVENT
    // ---------------------------------------------------------

    [Fact]
    public async Task When_MessageDeleted_Should_BroadcastDeleteEvent()
    {
        var alice = Guid.NewGuid();
        var messageId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, alice, channelId);

        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        await svc.DeleteMessageAsync(messageId, alice);

        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageDeleted>(e =>
            e.ChannelId == channelId &&
            e.MessageId == messageId
        )), Times.Once);
    }

    [Fact]
    public async Task When_DeleteFailsDueToWrongAuthor_Should_NotBroadcast()
    {
        var messageId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, Guid.NewGuid(), Guid.NewGuid());
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        await svc.DeleteMessageAsync(messageId, Guid.NewGuid());

        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEvent>()), Times.Never);
    }

    [Fact]
    public async Task When_DeleteFailsDueToNotFound_Should_NotBroadcast()
    {
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>())).ReturnsAsync((Message?)null);

        var svc = CreateService();
        await svc.DeleteMessageAsync(Guid.NewGuid(), Guid.NewGuid());

        _realtime.Verify(r => r.NotifyAsync(It.IsAny<DmMessageEvent>()), Times.Never);
    }
}
