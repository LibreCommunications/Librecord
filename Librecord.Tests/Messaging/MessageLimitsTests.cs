using Librecord.Application;
using Librecord.Application.Messaging;
using Librecord.Application.Realtime.DMs;
using Librecord.Application.Realtime.Guild;
using Librecord.Domain.Identity;
using Librecord.Domain.Messaging.Common;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Messaging.Guild;
using Librecord.Domain.Social;
using Moq;

namespace Librecord.Tests.Messaging;

/// <summary>
/// Tests that message length and attachment size limits are enforced.
/// </summary>
public class MessageLimitsTests
{
    private readonly Mock<IDirectMessageRepository> _dmMessages = new();
    private readonly Mock<IDirectMessageChannelRepository> _dmChannels = new();
    private readonly Mock<IDmRealtimeNotifier> _dmRealtime = new();
    private readonly Mock<IBlockRepository> _blocks = new();
    private readonly Mock<IGuildMessageRepository> _guildMessages = new();
    private readonly Mock<IGuildRealtimeNotifier> _guildRealtime = new();

    private DirectMessageService CreateDmService() =>
        new(_dmMessages.Object, _dmChannels.Object, _dmRealtime.Object, _blocks.Object);

    private GuildChannelMessageService CreateGuildService() =>
        new(_guildMessages.Object, _guildRealtime.Object);

    private static DmChannel MakeDmChannel(Guid channelId, params Guid[] memberIds)
    {
        var channel = new DmChannel { Id = channelId };
        foreach (var uid in memberIds)
            channel.Members.Add(new DmChannelMember { ChannelId = channelId, UserId = uid });
        return channel;
    }

    // ---------------------------------------------------------
    // MESSAGE LENGTH — DM
    // ---------------------------------------------------------

    [Fact]
    public async Task When_DmMessageExceeds4000Chars_Should_Reject()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeDmChannel(channelId, userId, Guid.NewGuid());
        var content = new string('a', Limits.MaxMessageLength + 1);

        _dmChannels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateDmService();

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => svc.SendMessageAsync(channelId, userId, content));
        Assert.Contains($"{Limits.MaxMessageLength}", ex.Message);
    }

    [Fact]
    public async Task When_DmMessageExactlyAtLimit_Should_Succeed()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeDmChannel(channelId, userId, Guid.NewGuid());
        var content = new string('a', Limits.MaxMessageLength);

        _dmChannels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _dmMessages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => new Message
            {
                Id = id,
                UserId = userId,
                ContentText = content,
                CreatedAt = DateTime.UtcNow,
                User = new User { Id = userId, UserName = "test", DisplayName = "test" },
                DmContext = new DmChannelMessage
                {
                    MessageId = id, ChannelId = channelId,
                    EncryptionSalt = [], EncryptionAlgorithm = "AES-GCM"
                }
            });

        var svc = CreateDmService();
        var result = await svc.SendMessageAsync(channelId, userId, content);

        Assert.NotNull(result);
    }

    // ---------------------------------------------------------
    // MESSAGE LENGTH — GUILD
    // ---------------------------------------------------------

    [Fact]
    public async Task When_GuildMessageExceeds4000Chars_Should_Reject()
    {
        var content = new string('a', Limits.MaxMessageLength + 1);

        var svc = CreateGuildService();

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CreateMessageAsync(Guid.NewGuid(), Guid.NewGuid(), content));
        Assert.Contains($"{Limits.MaxMessageLength}", ex.Message);
    }

    // ---------------------------------------------------------
    // ATTACHMENT SIZE
    // ---------------------------------------------------------

    [Fact]
    public void When_CheckingMaxAttachmentSize_Should_Be25MB()
    {
        Assert.Equal(25 * 1024 * 1024, Limits.MaxAttachmentSize);
    }

    // ---------------------------------------------------------
    // CONSTANT VALUES
    // ---------------------------------------------------------

    [Fact]
    public void When_CheckingMaxMessageLength_Should_Be4000()
    {
        Assert.Equal(4000, Limits.MaxMessageLength);
    }

    [Fact]
    public void When_CheckingMaxAvatarSize_Should_Be5MB()
    {
        Assert.Equal(5 * 1024 * 1024, Limits.MaxAvatarSize);
    }
}
