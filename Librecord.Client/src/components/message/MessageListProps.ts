import type { Message } from "../../types/message";

export type ScrollIntentRef = {
    current: boolean;
};

export interface MessageListProps {
    channelId?: string;
    messages: Message[];
    loading: boolean;
    currentUserId?: string;

    lastReadMessageId?: string | null;
    menuOpenId: string | null;
    editingId: string | null;

    setMenuOpenId: React.Dispatch<React.SetStateAction<string | null>>;
    setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
    
    editMessage: (
        messageId: string,
        dto: { content: string }
    ) => Promise<void>;

    deleteMessage: (messageId: string) => Promise<void>;

    onPinMessage?: (messageId: string) => void;
    pinnedMessageIds?: Set<string>;
    onStartThread?: (messageId: string) => void;
    onOpenThread?: (messageId: string) => void;

    canManageMessages?: boolean;
    canAddReactions?: boolean;
    canSendMessages?: boolean;
    onReply: (messageId: string) => void;
    onAddReaction: (messageId: string, emoji: string) => void;
    onRemoveReaction: (messageId: string, emoji: string) => void;

    getAvatarUrl: (avatarUrl?: string | null) => string;

    forceScrollOnNextUpdateRef?: ScrollIntentRef;

    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;

    onMarkAsRead?: (channelId: string, messageId: string) => void;
}
