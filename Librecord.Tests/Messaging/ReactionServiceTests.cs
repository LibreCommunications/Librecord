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
    public async Task AddReaction_New_PersistsReaction()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        _reactions.Setup(r => r.GetAsync(messageId, userId, "👍")).ReturnsAsync((MessageReaction?)null);

        var svc = CreateService();
        var result = await svc.AddReactionAsync(messageId, userId, "👍");

        Assert.Equal("👍", result.Emoji);
        Assert.Equal(messageId, result.MessageId);
        Assert.Equal(userId, result.UserId);
        _reactions.Verify(r => r.AddAsync(It.Is<MessageReaction>(mr =>
            mr.MessageId == messageId &&
            mr.UserId == userId &&
            mr.Emoji == "👍"
        )), Times.Once);
        _reactions.Verify(r => r.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task AddReaction_AlreadyExists_ReturnsExisting()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var existing = new MessageReaction
        {
            MessageId = messageId,
            UserId = userId,
            Emoji = "👍"
        };

        _reactions.Setup(r => r.GetAsync(messageId, userId, "👍")).ReturnsAsync(existing);

        var svc = CreateService();
        var result = await svc.AddReactionAsync(messageId, userId, "👍");

        Assert.Same(existing, result);
        _reactions.Verify(r => r.AddAsync(It.IsAny<MessageReaction>()), Times.Never);
    }

    [Fact]
    public async Task AddReaction_EmptyEmoji_Throws()
    {
        var svc = CreateService();

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.AddReactionAsync(Guid.NewGuid(), Guid.NewGuid(), "  "));
    }

    [Fact]
    public async Task AddReaction_TrimsEmoji()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        _reactions.Setup(r => r.GetAsync(messageId, userId, " 🔥 ")).ReturnsAsync((MessageReaction?)null);

        var svc = CreateService();
        var result = await svc.AddReactionAsync(messageId, userId, " 🔥 ");

        Assert.Equal("🔥", result.Emoji);
    }

    // ---------------------------------------------------------
    // REMOVE REACTION
    // ---------------------------------------------------------

    [Fact]
    public async Task RemoveReaction_Calls_RepositoryAndSaves()
    {
        var messageId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var svc = CreateService();
        await svc.RemoveReactionAsync(messageId, userId, "👎");

        _reactions.Verify(r => r.RemoveAsync(messageId, userId, "👎"), Times.Once);
        _reactions.Verify(r => r.SaveChangesAsync(), Times.Once);
    }
}
