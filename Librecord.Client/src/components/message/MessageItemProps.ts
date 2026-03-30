import type { Message } from "../../types/message";

export interface MessageItemProps {
    msg: Message;
    isAuthor: boolean;
    isEditing: boolean;
    menuOpen: boolean;
    currentUserId?: string;
    isPinned?: boolean;

    canManageMessages?: boolean;

    onToggleMenu: (messageId: string) => void;
    onStartEdit: (messageId: string) => void;
    onReply: (messageId: string) => void;
    onScrollToReply?: (messageId: string) => void;
    onCancelEdit: () => void;
    onDelete: (messageId: string) => void;
    onPin?: (messageId: string) => void;
    onStartThread?: (messageId: string) => void;
    onOpenThread?: (messageId: string) => void;
    onAddReaction: (messageId: string, emoji: string) => void;
    onRemoveReaction: (messageId: string, emoji: string) => void;

    editMessage: (
        messageId: string,
        dto: { content: string }
    ) => Promise<void>;

    getAvatarUrl: (avatarUrl?: string | null) => string;
}
