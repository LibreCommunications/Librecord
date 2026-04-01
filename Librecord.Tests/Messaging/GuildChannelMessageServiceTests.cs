using Librecord.Application.Messaging;
using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Guild;
using Moq;

namespace Librecord.Tests.Messaging;

public class GuildChannelMessageServiceTests
{
    private readonly Mock<IGuildMessageRepository> _messages = new();
    private readonly Mock<IGuildRealtimeNotifier> _realtime = new();

    private GuildChannelMessageService CreateService() =>
        new(_messages.Object, _realtime.Object);

    private static Message MakeHydratedMessage(Guid id, Guid userId, Guid channelId, string content = "hello")
    {
        return new Message
        {
            Id = id,
            UserId = userId,
            ContentText = content,
            CreatedAt = DateTime.UtcNow,
            User = new User
            {
                Id = userId,
                UserName = "testuser",
                DisplayName = "testuser"
            },
            GuildContext = new GuildChannelMessage
            {
                MessageId = id,
                ChannelId = channelId,
                EncryptionSalt = [],
                EncryptionAlgorithm = "AES-GCM"
            }
        };
    }

    // ---------------------------------------------------------
    // CREATE MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_CreatingMessageWithValidContent_Should_PersistAndNotify()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, userId, channelId));

        var svc = CreateService();
        var result = await svc.CreateMessageAsync(channelId, userId, "hello", "client-id");

        Assert.NotNull(result);
        _messages.Verify(m => m.AddMessageAsync(It.Is<Message>(msg =>
            msg.UserId == userId && msg.ContentText == "hello"
        ), channelId), Times.Once);
        _messages.Verify(m => m.SaveChangesAsync(), Times.Once);
        _realtime.Verify(r => r.NotifyAsync(It.Is<GuildMessageCreated>(e =>
            e.ChannelId == channelId &&
            e.ClientMessageId == "client-id"
        )), Times.Once);
    }

    [Fact]
    public async Task When_CreatingMessageWithEmptyContent_Should_Reject()
    {
        var svc = CreateService();

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CreateMessageAsync(Guid.NewGuid(), Guid.NewGuid(), "  "));
    }

    [Fact]
    public async Task When_CreatingMessageWithEmptyContentButAttachments_Should_Succeed()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, userId, channelId));

        var svc = CreateService();
        var result = await svc.CreateMessageAsync(channelId, userId, "", "cid", hasAttachments: true);

        Assert.NotNull(result);
    }

    [Fact]
    public async Task When_CreatingMessage_Should_TrimContent()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => MakeHydratedMessage(id, userId, channelId, "trimmed"));

        var svc = CreateService();
        await svc.CreateMessageAsync(channelId, userId, "  trimmed  ");

        _messages.Verify(m => m.AddMessageAsync(It.Is<Message>(msg =>
            msg.ContentText == "trimmed"
        ), channelId), Times.Once);
    }

    // ---------------------------------------------------------
    // EDIT MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_EditingOwnMessage_Should_UpdateAndNotify()
    {
        var userId = Guid.NewGuid();
        var messageId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, userId, channelId);

        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        var result = await svc.EditMessageAsync(messageId, userId, "updated");

        Assert.Equal("updated", result.ContentText);
        _messages.Verify(m => m.AddMessageEditAsync(It.Is<MessageEdit>(e =>
            e.MessageId == messageId &&
            e.EditorUserId == userId
        )), Times.Once);
        _realtime.Verify(r => r.NotifyAsync(It.Is<GuildMessageEdited>(e =>
            e.MessageId == messageId &&
            e.Content == "updated"
        )), Times.Once);
    }

    [Fact]
    public async Task When_EditingAnotherUsersMessage_Should_Reject()
    {
        var messageId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, Guid.NewGuid(), Guid.NewGuid());
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.EditMessageAsync(messageId, Guid.NewGuid(), "hacked"));
    }

    [Fact]
    public async Task When_EditingNonExistentMessage_Should_Reject()
    {
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>())).ReturnsAsync((Message?)null);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.EditMessageAsync(Guid.NewGuid(), Guid.NewGuid(), "text"));
    }

    [Fact]
    public async Task When_EditingMessageWithSameContent_Should_NoOp()
    {
        var userId = Guid.NewGuid();
        var messageId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, userId, Guid.NewGuid(), "same");
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        await svc.EditMessageAsync(messageId, userId, "same");

        _messages.Verify(m => m.AddMessageEditAsync(It.IsAny<MessageEdit>()), Times.Never);
        _realtime.Verify(r => r.NotifyAsync(It.IsAny<GuildMessageEdited>()), Times.Never);
    }

    // ---------------------------------------------------------
    // DELETE MESSAGE
    // ---------------------------------------------------------

    [Fact]
    public async Task When_DeletingMessage_Should_RemoveAndNotify()
    {
        var messageId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var message = MakeHydratedMessage(messageId, Guid.NewGuid(), channelId);
        _messages.Setup(m => m.GetMessageAsync(messageId)).ReturnsAsync(message);

        var svc = CreateService();
        await svc.DeleteMessageAsync(messageId);

        _messages.Verify(m => m.DeleteMessageAsync(messageId), Times.Once);
        _realtime.Verify(r => r.NotifyAsync(It.Is<GuildMessageDeleted>(e =>
            e.MessageId == messageId &&
            e.ChannelId == channelId
        )), Times.Once);
    }

    [Fact]
    public async Task When_DeletingNonExistentMessage_Should_Reject()
    {
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>())).ReturnsAsync((Message?)null);

        var svc = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.DeleteMessageAsync(Guid.NewGuid()));
    }
}
