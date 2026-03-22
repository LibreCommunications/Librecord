import type { Message } from "../../types/message";

export type ScrollIntentRef = {
    current: boolean;
};

export interface MessageListProps {
    messages: Message[];
    loading: boolean;
    currentUserId?: string;

    menuOpenId: string | null;
    editingId: string | null;

    setMenuOpenId: (id: string | null) => void;
    setEditingId: (id: string | null) => void;
    
    editMessage: (
        messageId: string,
        dto: { content: string }
    ) => Promise<void>;

    deleteMessage: (messageId: string) => Promise<void>;

    onPinMessage?: (messageId: string) => void;
    pinnedMessageIds?: Set<string>;

    onAddReaction: (messageId: string, emoji: string) => void;
    onRemoveReaction: (messageId: string, emoji: string) => void;

    getAvatarUrl: (avatarUrl?: string | null) => string;

    forceScrollOnNextUpdateRef?: ScrollIntentRef;

    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
}
