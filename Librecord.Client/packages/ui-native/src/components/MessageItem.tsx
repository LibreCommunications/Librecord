import { useEffect, useState } from "react";
import {
    Image,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createThumbnail } from "react-native-create-thumbnail";
import CookieManager from "@react-native-cookies/cookies";
import RNFS from "react-native-fs";
import { API_URL } from "@librecord/api-client";
import { logger } from "@librecord/domain";
import type { Message, MessageAttachment } from "@librecord/domain";
import type { MediaTarget, RootStackParamList } from "../navigation/types.ts";

// Keeps generated thumbnails in memory for the session so scrolling a chat
// back to a video doesn't re-extract frames every time.
const thumbCache = new Map<string, string>();

/**
 * react-native-create-thumbnail's MediaMetadataRetriever path on Android
 * rejects HTTPS URLs with a bare "no such file" error even though the library
 * claims to support them. Working around: download the video to cache with
 * our session cookie attached, then extract the thumbnail from the local
 * file, then delete the downloaded video. Results are session-cached.
 */
async function generateVideoThumbnail(uri: string): Promise<string | null> {
    const cached = thumbCache.get(uri);
    if (cached) return cached;
    let localVideo: string | null = null;
    try {
        const cookies = await CookieManager.get(uri);
        const entries = Object.entries(cookies);
        const cookieHeader = entries.length
            ? entries.map(([n, c]) => `${n}=${c.value}`).join("; ")
            : undefined;

        localVideo = `${RNFS.CachesDirectoryPath}/thumb-src-${Date.now()}.mp4`;
        logger.ui.debug(`thumb: downloading ${uri}`);
        const dl = await RNFS.downloadFile({
            fromUrl: uri,
            toFile: localVideo,
            headers: cookieHeader ? { Cookie: cookieHeader } : {},
        }).promise;
        if (dl.statusCode < 200 || dl.statusCode >= 300) {
            throw new Error(`download HTTP ${dl.statusCode}`);
        }

        const res = await createThumbnail({
            url: `file://${localVideo}`,
            timeStamp: 1000,
            format: "jpeg",
        });
        logger.ui.debug(`thumb: ok path=${res.path}`);
        thumbCache.set(uri, res.path);
        return res.path;
    } catch (err) {
        logger.ui.warn(`thumb: failed for ${uri}`, err);
        return null;
    } finally {
        if (localVideo) RNFS.unlink(localVideo).catch(() => {});
    }
}

export type MobileOptimisticMessage = Message & { clientMessageId?: string; pending?: boolean };

function resolveAttachmentUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_URL}${url}`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MessageItem({
    message,
    showHeader,
}: {
    message: MobileOptimisticMessage;
    showHeader: boolean;
}) {
    const avatarSrc = message.author.avatarUrl ? `${API_URL}${message.author.avatarUrl}` : null;
    const initial = message.author.displayName.charAt(0).toUpperCase();
    const time = new Date(message.createdAt);
    const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const navigation = useNavigation<Nav>();
    const openMedia = (target: MediaTarget) => navigation.navigate("Media", target);

    return (
        <View style={[styles.msg, !showHeader && styles.msgContinuation, message.pending && styles.msgPending]}>
            <View style={styles.msgAvatar}>
                {showHeader && (
                    avatarSrc
                        ? <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
                        : <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{initial}</Text></View>
                )}
            </View>
            <View style={styles.msgBody}>
                {showHeader && (
                    <View style={styles.msgHeader}>
                        <Text style={styles.msgAuthor}>{message.author.displayName}</Text>
                        <Text style={styles.msgTime}>{timeStr}</Text>
                    </View>
                )}
                {message.content ? <Text style={styles.msgContent}>{message.content}</Text> : null}
                {message.editedAt && <Text style={styles.msgEdited}>(edited)</Text>}
                {message.attachments.length > 0 && (
                    <View style={styles.attachments}>
                        {message.attachments.map((att) => (
                            <AttachmentView
                                key={att.id}
                                attachment={att}
                                onOpen={openMedia}
                            />
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

function AttachmentView({
    attachment,
    onOpen,
}: {
    attachment: MessageAttachment;
    onOpen: (target: MediaTarget) => void;
}) {
    const uri = resolveAttachmentUrl(attachment.url);
    const contentType = attachment.contentType ?? "";

    if (contentType.startsWith("image/")) {
        return (
            <ImageAttachment
                uri={uri}
                attachment={attachment}
                onOpen={() => onOpen({
                    kind: "image",
                    uri,
                    fileName: attachment.fileName,
                    width: attachment.width,
                    height: attachment.height,
                })}
            />
        );
    }
    if (contentType.startsWith("video/")) {
        return (
            <VideoThumb
                uri={uri}
                attachment={attachment}
                onOpen={() => onOpen({
                    kind: "video",
                    uri,
                    fileName: attachment.fileName,
                    width: attachment.width,
                    height: attachment.height,
                })}
            />
        );
    }
    if (contentType.startsWith("audio/")) {
        return <AudioAttachment uri={uri} attachment={attachment} />;
    }
    return <FileAttachment uri={uri} attachment={attachment} />;
}

function mediaDims(
    attachment: MessageAttachment,
    screenW: number,
    maxH = 320,
): { width: number; height: number } {
    const maxW = Math.min(screenW - 72, 400);
    if (attachment.width && attachment.height) {
        const scale = Math.min(maxW / attachment.width, maxH / attachment.height, 1);
        return { width: attachment.width * scale, height: attachment.height * scale };
    }
    return { width: maxW, height: maxH };
}

function ImageAttachment({
    uri,
    attachment,
    onOpen,
}: {
    uri: string;
    attachment: MessageAttachment;
    onOpen: () => void;
}) {
    const { width: sw } = useWindowDimensions();
    const { width, height } = mediaDims(attachment, sw);
    return (
        <Pressable onPress={onOpen}>
            <Image
                source={{ uri }}
                style={[styles.image, { width, height }]}
                resizeMode="cover"
                accessibilityLabel={attachment.fileName}
            />
        </Pressable>
    );
}

/**
 * Show a static thumbnail with a play icon overlay rather than an inline
 * Video. ExoPlayer has its own HTTP stack and its own layout quirks; keeping
 * the chat row lightweight and deferring to MediaLightbox for playback avoids
 * both problems.
 */
function VideoThumb({
    uri,
    attachment,
    onOpen,
}: {
    uri: string;
    attachment: MessageAttachment;
    onOpen: () => void;
}) {
    const { width: sw } = useWindowDimensions();
    const { width, height } = mediaDims(attachment, sw);
    const [thumb, setThumb] = useState<string | null>(() => thumbCache.get(uri) ?? null);

    useEffect(() => {
        if (thumb) return;
        let cancelled = false;
        generateVideoThumbnail(uri).then((path) => {
            if (!cancelled && path) setThumb(path);
        });
        return () => { cancelled = true; };
    }, [uri, thumb]);

    return (
        <Pressable onPress={onOpen} style={[styles.videoThumb, { width, height }]}>
            {thumb && (
                <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            )}
            <View style={styles.playBadge}>
                <Text style={styles.playGlyph}>▶</Text>
            </View>
            <Text style={styles.videoCaption} numberOfLines={1}>{attachment.fileName}</Text>
        </Pressable>
    );
}

function AudioAttachment({ uri, attachment }: { uri: string; attachment: MessageAttachment }) {
    return (
        <Pressable
            onPress={() => Linking.openURL(uri)}
            style={({ pressed }) => [styles.fileRow, pressed && styles.filePressed]}
        >
            <View style={styles.fileIcon}><Text style={styles.fileGlyph}>🎵</Text></View>
            <View style={styles.fileMeta}>
                <Text style={styles.fileName} numberOfLines={1}>{attachment.fileName}</Text>
                <Text style={styles.fileSub}>{formatBytes(attachment.size)}</Text>
            </View>
        </Pressable>
    );
}

function FileAttachment({ uri, attachment }: { uri: string; attachment: MessageAttachment }) {
    return (
        <Pressable
            onPress={() => Linking.openURL(uri)}
            style={({ pressed }) => [styles.fileRow, pressed && styles.filePressed]}
        >
            <View style={styles.fileIcon}><Text style={styles.fileGlyph}>📄</Text></View>
            <View style={styles.fileMeta}>
                <Text style={styles.fileName} numberOfLines={1}>{attachment.fileName}</Text>
                <Text style={styles.fileSub}>{formatBytes(attachment.size)}</Text>
            </View>
        </Pressable>
    );
}

const AVATAR = 36;

const styles = StyleSheet.create({
    msg: { flexDirection: "row", marginTop: 12 },
    msgContinuation: { marginTop: 2 },
    msgPending: { opacity: 0.6 },
    msgAvatar: { width: AVATAR + 8, alignItems: "flex-start" },
    avatarImg: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
    avatarFallback: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: AVATAR / 2,
        backgroundColor: "#2a2b33",
        alignItems: "center",
        justifyContent: "center",
    },
    avatarFallbackText: { color: "#fff", fontWeight: "600" },
    msgBody: { flex: 1 },
    msgHeader: { flexDirection: "row", alignItems: "baseline", marginBottom: 2 },
    msgAuthor: { color: "#fff", fontSize: 14, fontWeight: "600", marginRight: 8 },
    msgTime: { color: "#8a8fa7", fontSize: 11 },
    msgContent: { color: "#dcdde1", fontSize: 15, lineHeight: 20 },
    msgEdited: { color: "#8a8fa7", fontSize: 11, marginTop: 2 },

    attachments: { marginTop: 6, gap: 6 },
    image: { borderRadius: 8, backgroundColor: "#16171c" },

    videoThumb: {
        borderRadius: 8,
        backgroundColor: "#0a0a0d",
        borderWidth: 1,
        borderColor: "#1e1f22",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    playBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    playGlyph: { color: "#fff", fontSize: 22, marginLeft: 4 },
    videoCaption: {
        color: "#8a8fa7",
        fontSize: 11,
        position: "absolute",
        bottom: 8,
        left: 10,
        right: 10,
    },

    fileRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16171c",
        borderRadius: 8,
        padding: 10,
        gap: 10,
        alignSelf: "flex-start",
        maxWidth: 320,
    },
    filePressed: { opacity: 0.7 },
    fileIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    fileGlyph: { fontSize: 20 },
    fileMeta: { flex: 1 },
    fileName: { color: "#00a8fc", fontSize: 14, fontWeight: "500" },
    fileSub: { color: "#8a8fa7", fontSize: 12, marginTop: 2 },
});
