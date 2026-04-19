import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { dmMessages } from "@librecord/api-client";
import { MessageItem, type MobileOptimisticMessage } from "../components/MessageItem.tsx";
import { AuthContext } from "@librecord/app/context";
import { onCustomEvent } from "@librecord/app/typedEvent";
import { usePlatform } from "@librecord/platform-native";
import type { AppEventMap } from "@librecord/domain";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.ts";

type Props = NativeStackScreenProps<RootStackParamList, "DmChannel">;
type OptimisticMessage = MobileOptimisticMessage;

const PAGE_SIZE = 50;

export function DmChannelScreen({ navigation, route }: Props) {
    const { channelId, title } = route.params;
    const { user } = useContext(AuthContext);
    const { uuid } = usePlatform();

    const [messages, setMessages] = useState<OptimisticMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const channelIdRef = useRef(channelId);
    useEffect(() => { channelIdRef.current = channelId; }, [channelId]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setMessages([]);
        setHasMore(true);

        dmMessages.list(channelId, PAGE_SIZE).then((list) => {
            if (cancelled) return;
            const normalized = [...list].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            setMessages(normalized);
            setHasMore(list.length >= PAGE_SIZE);
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [channelId]);

    const loadOlder = useCallback(async () => {
        if (loadingMore || !hasMore || messages.length === 0) return;
        setLoadingMore(true);
        const oldest = messages[messages.length - 1];
        try {
            const older = await dmMessages.list(channelId, PAGE_SIZE, oldest.id);
            if (older.length === 0) {
                setHasMore(false);
            } else {
                const sorted = [...older].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                );
                setMessages((prev) => [...prev, ...sorted]);
                setHasMore(older.length >= PAGE_SIZE);
            }
        } finally {
            setLoadingMore(false);
        }
    }, [channelId, hasMore, loadingMore, messages]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:message:new"]>("dm:message:new", (d) => {
            if (d.message.channelId !== channelIdRef.current) return;
            setMessages((prev) => {
                if (d.clientMessageId) {
                    const idx = prev.findIndex((m) => m.clientMessageId === d.clientMessageId);
                    if (idx !== -1) {
                        const next = prev.slice();
                        next[idx] = { ...d.message };
                        return next;
                    }
                }
                if (prev.some((m) => m.id === d.message.id)) return prev;
                return [d.message, ...prev];
            });
        });
    }, []);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:message:edited"]>("dm:message:edited", (d) => {
            setMessages((prev) =>
                prev.map((m) => (m.id === d.messageId ? { ...m, content: d.content, editedAt: d.editedAt } : m)),
            );
        });
    }, []);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:message:deleted"]>("dm:message:deleted", (d) => {
            setMessages((prev) => prev.filter((m) => m.id !== d.messageId));
        });
    }, []);

    useEffect(() => {
        return onCustomEvent<AppEventMap["dm:channel:deleted"]>("dm:channel:deleted", (d) => {
            if (d.channelId === channelIdRef.current) navigation.goBack();
        });
    }, [navigation]);

    async function onSend() {
        const content = draft.trim();
        if (!content || sending || !user) return;

        const clientMessageId = uuid.generate();
        const optimistic: OptimisticMessage = {
            id: `local:${clientMessageId}`,
            channelId,
            content,
            createdAt: new Date().toISOString(),
            editedAt: null,
            author: {
                id: user.userId,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl ?? null,
            },
            attachments: [],
            reactions: [],
            edits: [],
            clientMessageId,
            pending: true,
        };
        setMessages((prev) => [optimistic, ...prev]);
        setDraft("");
        setSending(true);

        try {
            await dmMessages.send(channelId, content, clientMessageId);
        } catch {
            setMessages((prev) =>
                prev.map((m) =>
                    m.clientMessageId === clientMessageId
                        ? { ...m, pending: false, content: `${m.content} (failed to send)` }
                        : m,
                ),
            );
        } finally {
            setSending(false);
        }
    }

    return (
        <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
                    <Text style={styles.backGlyph}>‹</Text>
                </Pressable>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>

            <KeyboardAvoidingView
                style={styles.body}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator color="#5865f2" />
                    </View>
                ) : (
                    <FlatList
                        data={messages}
                        keyExtractor={(m) => m.id}
                        inverted
                        renderItem={({ item, index }) => {
                            const prev = messages[index + 1];
                            const showHeader = !prev || prev.author.id !== item.author.id;
                            return <MessageItem message={item} showHeader={showHeader} />;
                        }}
                        onEndReached={loadOlder}
                        onEndReachedThreshold={0.4}
                        ListFooterComponent={
                            loadingMore
                                ? <View style={styles.moreLoader}><ActivityIndicator color="#5865f2" /></View>
                                : null
                        }
                        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 }}
                    />
                )}

                <View style={styles.composer}>
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={`Message ${title}`}
                        placeholderTextColor="#666"
                        style={styles.input}
                        multiline
                    />
                    <Pressable
                        onPress={onSend}
                        disabled={!draft.trim() || sending}
                        style={({ pressed }) => [
                            styles.sendBtn,
                            (!draft.trim() || sending) && styles.sendDisabled,
                            pressed && styles.sendPressed,
                        ]}
                    >
                        <Text style={styles.sendGlyph}>{sending ? "…" : "➤"}</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b0f" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#16171c",
    },
    back: { paddingHorizontal: 8, paddingVertical: 4 },
    backGlyph: { color: "#8a8fa7", fontSize: 32, lineHeight: 32 },
    title: { color: "#fff", fontSize: 17, fontWeight: "600", flex: 1, marginLeft: 4 },
    body: { flex: 1 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    moreLoader: { paddingVertical: 16 },

    composer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: "#16171c",
        backgroundColor: "#0b0b0f",
    },
    input: {
        flex: 1,
        backgroundColor: "#16171c",
        color: "#fff",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        maxHeight: 120,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#5865f2",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
    },
    sendDisabled: { opacity: 0.4 },
    sendPressed: { opacity: 0.85 },
    sendGlyph: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
