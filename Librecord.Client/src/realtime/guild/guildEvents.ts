import type { Message } from "../../types/message";

export interface GuildEventMap {
    "guild:message:new": {
        message: Message;
        clientMessageId?: string;
    };

    "guild:message:edited": {
        channelId: string;
        messageId: string;
        content: string;
        editedAt?: string;
    };

    "guild:message:deleted": {
        channelId: string;
        messageId: string;
    };

    "guild:user:typing": {
        channelId: string;
        userId: string;
        username: string;
    };

    "guild:user:presence": {
        userId: string;
        status: string;
    };

    "guild:channel:created": {
        channelId: string;
        guildId: string;
        name: string;
        type: number;
        position: number;
    };

    "voice:user:joined": {
        channelId: string;
        guildId: string;
        userId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    };

    "voice:user:left": {
        channelId: string;
        guildId: string;
        userId: string;
    };

    "voice:user:state": {
        channelId: string;
        guildId: string;
        userId: string;
        isMuted: boolean;
        isDeafened: boolean;
        isCameraOn: boolean;
        isScreenSharing: boolean;
    };
}
