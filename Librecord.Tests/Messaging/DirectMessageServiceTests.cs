using Librecord.Application.Messaging;
using Librecord.Application.Realtime.DMs;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;
using Moq;

namespace Librecord.Tests.Messaging;

public class DirectMessageServiceTests
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

    private static Message MakeHydratedMessage(Guid id, Guid userId, Guid channelId, string content = "hello")
    {
        var user = MakeUser(userId);
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
    // SEND MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_SendingMessageWithValidContent_Should_CreateAndNotify()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, userId, Guid.NewGuid());

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, userId, channelId));

        var svc = CreateService();
        var result = await svc.SendMessageAsync(channelId, userId, "hello", "client-123");

        Assert.NotNull(result);
        _messages.Verify(m => m.AddMessageAsync(It.IsAny<Message>(), channelId), Times.Once);
        _realtime.Verify(r => r.NotifyAsync(It.Is<DmMessageCreated>(e =>
            e.ChannelId == channelId &&
            e.ClientMessageId == "client-123"
        )), Times.Once);
    }

    [Fact]
    public async Task When_SendingEmptyContent_Should_Reject()
    {
        var svc = CreateService();

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.SendMessageAsync(Guid.NewGuid(), Guid.NewGuid(), "  "));
    }

    [Fact]
    public async Task When_SendingEmptyContentWithAttachments_Should_Succeed()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, userId, Guid.NewGuid());

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, userId, channelId));

        var svc = CreateService();
        var result = await svc.SendMessageAsync(channelId, userId, "", "cid", hasAttachments: true);

        Assert.NotNull(result);
    }

    [Fact]
    public async Task When_SendingToBlockedUser_Should_Reject()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _blocks.Setup(b => b.IsEitherBlockedAsync(alice, bob)).ReturnsAsync(true);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync(channelId, alice, "blocked msg"));
        Assert.Contains("Cannot send", ex.Message);
    }

    [Fact]
    public async Task When_SendingToNonExistentChannel_Should_Reject()
    {
        _channels.Setup(c => c.GetChannelAsync(It.IsAny<Guid>())).ReturnsAsync((DmChannel?)null);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.SendMessageAsync(Guid.NewGuid(), Guid.NewGuid(), "hi"));
    }

    [Fact]
    public async Task When_SendingAsNonMember_Should_Reject()
    {
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, Guid.NewGuid());
        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.SendMessageAsync(channelId, Guid.NewGuid(), "hi"));
    }

    [Fact]
    public async Task When_SendingInGroupDm_Should_SkipBlockCheck()
    {
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var charlie = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, alice, bob, charlie);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, alice, channelId));

        var svc = CreateService();
        var result = await svc.SendMessageAsync(channelId, alice, "group msg");

        Assert.NotNull(result);
        _blocks.Verify(b => b.IsEitherBlockedAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    // ---------------------------------------------------------
    // EDIT MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_EditingOwnMessage_Should_UpdateContent()
    {
        var userId = Guid.NewGuid();
        var messageId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, userId, channelId);

        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        var result = await svc.EditMessageAsync(messageId, userId, "updated");

        Assert.NotNull(result);
        Assert.Equal("updated", result.ContentText);
    }

    [Fact]
    public async Task When_EditingAnotherUsersMessage_Should_Reject()
    {
        var messageId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, Guid.NewGuid(), Guid.NewGuid());
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        var result = await svc.EditMessageAsync(messageId, Guid.NewGuid(), "hacked");

        Assert.Null(result);
    }

    [Fact]
    public async Task When_EditingWithEmptyContent_Should_Reject()
    {
        var svc = CreateService();
        var result = await svc.EditMessageAsync(Guid.NewGuid(), Guid.NewGuid(), "  ");

        Assert.Null(result);
    }

    // ---------------------------------------------------------
    // DELETE MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_DeletingOwnMessage_Should_Succeed()
    {
        var userId = Guid.NewGuid();
        var messageId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, userId, channelId);

        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        var result = await svc.DeleteMessageAsync(messageId, userId);

        Assert.True(result);
        _messages.Verify(m => m.DeleteMessageAsync(messageId), Times.Once);
    }

    [Fact]
    public async Task When_DeletingAnotherUsersMessage_Should_Reject()
    {
        var messageId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, Guid.NewGuid(), Guid.NewGuid());
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        var result = await svc.DeleteMessageAsync(messageId, Guid.NewGuid());

        Assert.False(result);
    }

    [Fact]
    public async Task When_DeletingNonExistentMessage_Should_ReturnFalse()
    {
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>())).ReturnsAsync((Message?)null);

        var svc = CreateService();
        var result = await svc.DeleteMessageAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.False(result);
    }

    // ---------------------------------------------------------
    // FETCH MESSAGES
    // ---------------------------------------------------------

    [Fact]
    public async Task When_FetchingMessagesAsMember_Should_ReturnMessages()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, userId);
        var messages = new List<Message> { new() { Id = Guid.NewGuid() } };

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetChannelMessagesAsync(channelId, 50, null)).ReturnsAsync(messages);

        var svc = CreateService();
        var result = await svc.GetMessagesAsync(channelId, userId);

        Assert.Single(result);
    }

    [Fact]
    public async Task When_FetchingMessagesAsNonMember_Should_ReturnEmpty()
    {
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, Guid.NewGuid());
        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();
        var result = await svc.GetMessagesAsync(channelId, Guid.NewGuid());

        Assert.Empty(result);
    }

    [Fact]
    public async Task When_FetchingMessagesFromMissingChannel_Should_ReturnEmpty()
    {
        _channels.Setup(c => c.GetChannelAsync(It.IsAny<Guid>())).ReturnsAsync((DmChannel?)null);

        var svc = CreateService();
        var result = await svc.GetMessagesAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.Empty(result);
    }
}
