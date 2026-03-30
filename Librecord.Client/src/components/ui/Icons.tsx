interface IconProps {
    size?: number;
    className?: string;
}

function Icon({ size = 20, className, children, viewBox = "0 0 24 24", fill = false }: IconProps & { children: React.ReactNode; viewBox?: string; fill?: boolean }) {
    return (
        <svg width={size} height={size} viewBox={viewBox} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            {children}
        </svg>
    );
}

// ── Navigation & Actions ────────────────────────────────────

export function CloseIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
}

export function PlusIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
}

export function ChevronDownIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polyline points="6 9 12 15 18 9" /></Icon>;
}

export function BackArrowIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>;
}

export function SearchIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
}

export function SettingsIcon({ size, className }: IconProps) {
    return (
        <Icon size={size} className={className}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </Icon>
    );
}

// ── Messaging ───────────────────────────────────────────────

export function ChatBubbleIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>;
}

export function EditIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></Icon>;
}

export function TrashIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Icon>;
}

export function ReplyIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></Icon>;
}

export function MoreIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className} fill><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></Icon>;
}

export function EmojiIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></Icon>;
}

export function PinIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></Icon>;
}

// ── People ──────────────────────────────────────────────────

export function PersonPlusIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></Icon>;
}

export function PersonsIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
}

export function KickIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" /></Icon>;
}

export function BanIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></Icon>;
}

export function ShieldIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>;
}

// ── Media & Files ───────────────────────────────────────────

export function PlayIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className} fill><polygon points="5 3 19 12 5 21 5 3" /></Icon>;
}

export function FullscreenIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></Icon>;
}

export function ExitFullscreenIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></Icon>;
}

export function ExternalLinkIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></Icon>;
}

export function FileIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></Icon>;
}

// ── Layout ──────────────────────────────────────────────────

export function FolderIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className} fill><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" /></Icon>;
}

export function LoginArrowIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></Icon>;
}

// ── Audio ───────────────────────────────────────────────────

export function SpeakerMutedIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></Icon>;
}

export function SpeakerLowIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></Icon>;
}

export function SpeakerFullIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></Icon>;
}

export function VoiceChannelIcon({ size, className }: IconProps) {
    return <Icon size={size} className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /></Icon>;
}
