using Librecord.Application;
using Librecord.Application.Messaging;
using Librecord.Application.Realtime.DMs;
using Librecord.Domain.Messaging.Direct;
using Librecord.Domain.Social;
using Moq;

namespace Librecord.Tests.Messaging;

/// <summary>
/// Tests that message length limits are enforced using the centralized
/// Limits.MaxMessageLength constant (not hardcoded values).
/// </summary>
public class MessageLimitsTests
{
    private readonly Mock<IDirectMessageRepository> _messages = new();
    private readonly Mock<IDirectMessageChannelRepository> _channels = new();
    private readonly Mock<IDmRealtimeNotifier> _realtime = new();
    private readonly Mock<IBlockRepository> _blocks = new();

    private DirectMessageService CreateService() =>
        new(_messages.Object, _channels.Object, _realtime.Object, _blocks.Object);

    private static DmChannel MakeChannel(Guid channelId, params Guid[] memberIds)
    {
        var channel = new DmChannel { Id = channelId };
        foreach (var uid in memberIds)
            channel.Members.Add(new DmChannelMember { ChannelId = channelId, UserId = uid });
        return channel;
    }

    [Fact]
    public async Task Send_ExactlyAtLimit_Succeeds()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, userId, Guid.NewGuid());
        var content = new string('a', Limits.MaxMessageLength);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);
        _messages.Setup(m => m.GetMessageAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => new Domain.Messaging.Common.Message
            {
                Id = id,
                UserId = userId,
                ContentText = content,
                CreatedAt = DateTime.UtcNow,
                User = new Domain.Identity.User { Id = userId, UserName = "test", DisplayName = "test" },
                DmContext = new DmChannelMessage
                {
                    MessageId = id,
                    ChannelId = channelId,
                    EncryptionSalt = [],
                    EncryptionAlgorithm = "AES-GCM"
                }
            });

        var svc = CreateService();
        var result = await svc.SendMessageAsync(channelId, userId, content);

        Assert.NotNull(result);
    }

    [Fact]
    public async Task Send_OverLimit_Throws()
    {
        var userId = Guid.NewGuid();
        var channelId = Guid.NewGuid();
        var channel = MakeChannel(channelId, userId, Guid.NewGuid());
        var content = new string('a', Limits.MaxMessageLength + 1);

        _channels.Setup(c => c.GetChannelAsync(channelId)).ReturnsAsync(channel);

        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => svc.SendMessageAsync(channelId, userId, content));

        Assert.Contains($"{Limits.MaxMessageLength}", ex.Message);
    }

    [Fact]
    public void MaxMessageLength_Is4000()
    {
        Assert.Equal(4000, Limits.MaxMessageLength);
    }

    [Fact]
    public void MaxAttachmentSize_Is25MB()
    {
        Assert.Equal(25 * 1024 * 1024, Limits.MaxAttachmentSize);
    }

    [Fact]
    public void MaxAvatarSize_Is5MB()
    {
        Assert.Equal(5 * 1024 * 1024, Limits.MaxAvatarSize);
    }
}
