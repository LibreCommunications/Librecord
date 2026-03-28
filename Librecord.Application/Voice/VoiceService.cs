using Librecord.Application.Guilds;
using Librecord.Application.Realtime.Voice;
using Librecord.Domain;
using Librecord.Domain.Guilds;
using Librecord.Domain.Identity;
using Librecord.Domain.Voice;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Librecord.Application.Voice;

public class VoiceService : IVoiceService
{
    private readonly IVoiceStateRepository _voiceStates;
    private readonly IGuildService _guilds;
    private readonly IUserRepository _users;
    private readonly ILiveKitTokenService _tokenService;
    private readonly IVoiceRealtimeNotifier _notifier;
    private readonly IUnitOfWork _uow;
    private readonly LiveKitOptions _liveKitOptions;

    public VoiceService(
        IVoiceStateRepository voiceStates,
        IGuildService guilds,
        IUserRepository users,
        ILiveKitTokenService tokenService,
        IVoiceRealtimeNotifier notifier,
        IUnitOfWork uow,
        IOptions<LiveKitOptions> liveKitOptions)
    {
        _voiceStates = voiceStates;
        _guilds = guilds;
        _users = users;
        _tokenService = tokenService;
        _notifier = notifier;
        _uow = uow;
        _liveKitOptions = liveKitOptions.Value;
    }

    public async Task<VoiceJoinResult> JoinVoiceChannelAsync(Guid channelId, Guid userId)
    {
        var canAccess = await _guilds.CanAccessChannelAsync(channelId, userId);
        if (!canAccess)
            throw new InvalidOperationException("You do not have access to this channel.");

        var channel = await _guilds.GetChannelAsync(channelId);
        if (channel is null)
            throw new InvalidOperationException("Channel not found.");

        if (channel.Type != GuildChannelType.Voice)
            throw new InvalidOperationException("Channel is not a voice channel.");

        var user = await _users.GetByIdAsync(userId);
        if (user is null)
            throw new InvalidOperationException("User not found.");

        var existing = await _voiceStates.GetByUserIdAsync(userId);
        Guid? previousChannelId = null;
        Guid? previousGuildId = null;

        // Remove old state first (separate save to avoid same-PK conflict)
        if (existing is not null)
        {
            previousChannelId = existing.ChannelId;
            previousGuildId = existing.GuildId;
            await _voiceStates.RemoveAsync(userId);
            await _voiceStates.SaveChangesAsync();
        }

        var voiceState = new VoiceState
        {
            UserId = userId,
            ChannelId = channelId,
            GuildId = channel.GuildId
        };

        await _voiceStates.AddAsync(voiceState);
        await _voiceStates.SaveChangesAsync();

        // Notify AFTER save
        if (previousChannelId.HasValue)
        {
            await _notifier.NotifyAsync(new VoiceUserLeft
            {
                ChannelId = previousChannelId.Value,
                GuildId = previousGuildId!.Value,
                UserId = userId
            });
        }

        var displayName = user.DisplayName ?? user.UserName!;
        var token = _tokenService.GenerateToken(userId, displayName, channelId);

        await _notifier.NotifyAsync(new VoiceUserJoined
        {
            ChannelId = channelId,
            GuildId = channel.GuildId,
            UserId = userId,
            Username = user.UserName!,
            DisplayName = displayName,
            AvatarUrl = user.AvatarUrl,
            IsMuted = voiceState.IsMuted,
            IsDeafened = voiceState.IsDeafened,
            IsCameraOn = voiceState.IsCameraOn,
            IsScreenSharing = voiceState.IsScreenSharing
        });

        var participants = await GetChannelParticipantsAsync(channelId);

        return new VoiceJoinResult
        {
            Token = token,
            WsUrl = _liveKitOptions.Host,
            Participants = participants
        };
    }

    public async Task LeaveVoiceChannelAsync(Guid userId)
    {
        var existing = await _voiceStates.GetByUserIdAsync(userId);
        if (existing is null) return;

        await _voiceStates.RemoveAsync(userId);

        try
        {
            await _voiceStates.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Row was already deleted by a concurrent call (e.g. explicit leave
            // racing with OnDisconnectedAsync). The desired state is achieved.
            return;
        }

        await _notifier.NotifyAsync(new VoiceUserLeft
        {
            ChannelId = existing.ChannelId,
            GuildId = existing.GuildId,
            UserId = userId
        });
    }

    public async Task UpdateVoiceStateAsync(Guid userId, VoiceStateUpdateDto update)
    {
        var state = await _voiceStates.GetByUserIdAsync(userId);
        if (state is null) return;

        if (update.IsMuted.HasValue) state.IsMuted = update.IsMuted.Value;
        if (update.IsDeafened.HasValue) state.IsDeafened = update.IsDeafened.Value;
        if (update.IsCameraOn.HasValue) state.IsCameraOn = update.IsCameraOn.Value;
        if (update.IsScreenSharing.HasValue) state.IsScreenSharing = update.IsScreenSharing.Value;

        await _voiceStates.UpdateAsync(state);
        await _voiceStates.SaveChangesAsync();

        await _notifier.NotifyAsync(new VoiceUserStateChanged
        {
            ChannelId = state.ChannelId,
            GuildId = state.GuildId,
            UserId = userId,
            IsMuted = state.IsMuted,
            IsDeafened = state.IsDeafened,
            IsCameraOn = state.IsCameraOn,
            IsScreenSharing = state.IsScreenSharing
        });
    }

    public Task<VoiceState?> GetVoiceStateAsync(Guid userId)
    {
        return _voiceStates.GetByUserIdAsync(userId);
    }

    public async Task<List<VoiceParticipantDto>> GetChannelParticipantsAsync(Guid channelId)
    {
        var states = await _voiceStates.GetByChannelIdAsync(channelId);
        if (states.Count == 0) return [];

        var userIds = states.Select(s => s.UserId).ToList();
        var users = await _users.GetByIdsAsync(userIds);
        var userMap = users.ToDictionary(u => u.Id);

        return states.Select(s =>
        {
            userMap.TryGetValue(s.UserId, out var user);
            return new VoiceParticipantDto
            {
                UserId = s.UserId,
                Username = user?.UserName ?? "Unknown",
                DisplayName = user?.DisplayName ?? user?.UserName ?? "Unknown",
                AvatarUrl = user?.AvatarUrl,
                IsMuted = s.IsMuted,
                IsDeafened = s.IsDeafened,
                IsCameraOn = s.IsCameraOn,
                IsScreenSharing = s.IsScreenSharing,
                JoinedAt = s.JoinedAt
            };
        }).ToList();
    }
}
