using Librecord.Application.Messaging;
using Librecord.Domain.Messaging.Common;
using Moq;

namespace Librecord.Tests.Messaging;

public class ReactionServiceTests
{
    private readonly Mock<IReactionRepository> _reactions = new();

    private ReactionService CreateService() => new(_reactions.Object);

    // ---------------------------------------------------------
    // ADD REACTION
    // ---------------------------------------------------------

    [Fact]
    public async Task When_AddingReaction_Should_Persist()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        _reactions.Setup(r => r.GetAsync(messageId, userId, "\ud83d\udc4d")).ReturnsAsync((MessageReaction?)null);

        var svc = CreateService();
        var result = await svc.AddReactionAsync(messageId, userId, "\ud83d\udc4d");

        Assert.Equal("\ud83d\udc4d", result.Emoji);
        Assert.Equal(messageId, result.MessageId);
        Assert.Equal(userId, result.UserId);
        _reactions.Verify(r => r.AddAsync(It.Is<MessageReaction>(mr =>
            mr.MessageId == messageId &&
            mr.UserId == userId &&
            mr.Emoji == "\ud83d\udc4d"
        )), Times.Once);
        _reactions.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task When_AddingDuplicateReaction_Should_ReturnExisting()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var existing = new MessageReaction
        {
            MessageId = messageId,
            UserId = userId,
            Emoji = "\ud83d\udc4d"
        };

        _reactions.Setup(r => r.GetAsync(messageId, userId, "\ud83d\udc4d")).ReturnsAsync(existing);

        var svc = CreateService();
        var result = await svc.AddReactionAsync(messageId, userId, "\ud83d\udc4d");

        Assert.Same(existing, result);
        _reactions.Verify(r => r.AddAsync(It.IsAny<MessageReaction>()), Times.Never);
    }

    [Fact]
    public async Task When_AddingEmptyEmoji_Should_Reject()
    {
        var svc = CreateService();

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.AddReactionAsync(Guid.NewGuid(), Guid.NewGuid(), "  "));
    }

    [Fact]
    public async Task When_AddingReaction_Should_TrimEmoji()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        _reactions.Setup(r => r.GetAsync(messageId, userId, " \ud83d\udd25 ")).ReturnsAsync((MessageReaction?)null);

        var svc = CreateService();
        var result = await svc.AddReactionAsync(messageId, userId, " \ud83d\udd25 ");

        Assert.Equal("\ud83d\udd25", result.Emoji);
    }

    // ---------------------------------------------------------
    // REMOVE REACTION
    // ---------------------------------------------------------

    [Fact]
    public async Task When_RemovingReaction_Should_Delete()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var svc = CreateService();
        await svc.RemoveReactionAsync(messageId, userId, "\ud83d\udc4e");

        _reactions.Verify(r => r.RemoveAsync(messageId, userId, "\ud83d\udc4e"), Times.Once);
        _reactions.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    // ---------------------------------------------------------
    // GET GUILD CHANNEL ID
    // ---------------------------------------------------------

    [Fact]
    public async Task When_GettingGuildChannelId_Should_ReturnCorrectIdForGuildMessages()
    {
        var messageId = Guid.NewGuid();
        var channelId = Guid.NewGuid();

        _reactions.Setup(r => r.GetMessageGuildChannelIdAsync(messageId)).ReturnsAsync(channelId);

        var svc = CreateService();
        var result = await svc.GetMessageGuildChannelIdAsync(messageId);

        Assert.Equal(channelId, result);
    }

    [Fact]
    public async Task When_GettingGuildChannelIdForNonGuildMessage_Should_ReturnNull()
    {
        var messageId = Guid.NewGuid();

        _reactions.Setup(r => r.GetMessageGuildChannelIdAsync(messageId)).ReturnsAsync((Guid?)null);

        var svc = CreateService();
        var result = await svc.GetMessageGuildChannelIdAsync(messageId);

        Assert.Null(result);
    }
}
