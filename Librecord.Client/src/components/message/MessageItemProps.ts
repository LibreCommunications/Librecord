import type { Message } from "../../types/message";

export interface MessageItemProps {
    msg: Message;
    isAuthor: boolean;
    isEditing: boolean;
    menuOpen: boolean;
    currentUserId?: string;
    isPinned?: boolean;

    onToggleMenu: () => void;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onDelete: () => void;
    onPin?: () => void;
    onAddReaction: (messageId: string, emoji: string) => void;
    onRemoveReaction: (messageId: string, emoji: string) => void;

    editMessage: (
        messageId: string,
        dto: { content: string }
    ) => Promise<void>;

    getAvatarUrl: (avatarUrl?: string | null) => string;
}
