import { useCallback, useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL, dms as dmsApi } from "@librecord/api-client";
import { AuthContext } from "@librecord/app/context";
import { onCustomEvent, onEvent } from "@librecord/app/typedEvent";
import type { DmChannel, DmUser, AppEventMap } from "@librecord/domain";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MobileHeader } from "../components/MobileHeader.tsx";
import type { RootStackParamList } from "../navigation/types.ts";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Pick the "other" participant for 1:1 DMs, or null for group channels. */
function otherMember(channel: DmChannel, myId: string | undefined): DmUser | null {
    if (channel.isGroup || !myId) return null;
    return channel.members.find((m) => m.id !== myId) ?? channel.members[0] ?? null;
}

function channelTitle(channel: DmChannel, myId: string | undefined): string {
    if (channel.isGroup) {
        if (channel.name) return channel.name;
        return channel.members
            .filter((m) => m.id !== myId)
            .map((m) => m.displayName)
            .join(", ");
    }
    return otherMember(channel, myId)?.displayName ?? "Direct Message";
}

export function DmsScreen() {
    const { user } = useContext(AuthContext);
    const navigation = useNavigation<Nav>();
    const [channels, setChannels] = useState<DmChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const list = await dmsApi.list();
            setChannels(list);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Refetch on any DM shape change — small list, cheap.
    useEffect(() => {
        const cleanups = [
            onCustomEvent<AppEventMap["dm:channel:created"]>("dm:channel:created", () => load()),
            onCustomEvent<AppEventMap["dm:channel:deleted"]>("dm:channel:deleted", (d) => {
                setChannels((prev) => prev.filter((c) => c.id !== d.channelId));
            }),
            onCustomEvent<AppEventMap["dm:member:added"]>("dm:member:added", () => load()),
            onCustomEvent<AppEventMap["dm:member:left"]>("dm:member:left", (d) => {
                if (d.userId === user?.userId) {
                    // We left — drop it.
                    setChannels((prev) => prev.filter((c) => c.id !== d.channelId));
                } else {
                    load();
                }
            }),
            onEvent("realtime:reconnected", () => load()),
        ];
        return () => cleanups.forEach((fn) => fn());
    }, [load, user?.userId]);

    return (
        <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
            <MobileHeader title="Direct Messages" />
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#5865f2" />
                </View>
            ) : (
                <FlatList
                    data={channels}
                    keyExtractor={(c) => c.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            tintColor="#5865f2"
                            onRefresh={() => { setRefreshing(true); load(); }}
                        />
                    }
                    ItemSeparatorComponent={() => <View style={styles.sep} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No direct messages yet.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const title = channelTitle(item, user?.userId);
                        return (
                            <DmRow
                                channel={item}
                                title={title}
                                myId={user?.userId}
                                onPress={() => navigation.navigate("DmChannel", { channelId: item.id, title })}
                            />
                        );
                    }}
                    contentContainerStyle={channels.length === 0 ? { flexGrow: 1 } : undefined}
                />
            )}
        </SafeAreaView>
    );
}

function DmRow({
    channel,
    title,
    myId,
    onPress,
}: {
    channel: DmChannel;
    title: string;
    myId: string | undefined;
    onPress: () => void;
}) {
    const other = otherMember(channel, myId);
    const avatarUrl = channel.isGroup ? null : other?.avatarUrl ?? null;
    const avatarSrc = avatarUrl ? `${API_URL}${avatarUrl}` : null;
    const initial = title.charAt(0).toUpperCase();
    const subtitle = channel.isGroup
        ? `Group · ${channel.members.length} members`
        : other ? `@${other.username}` : "";

    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.avatar}>
                {avatarSrc
                    ? <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
                    : <Text style={styles.avatarFallback}>{initial}</Text>
                }
            </View>
            <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
        </Pressable>
    );
}

const AVATAR = 44;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b0f" },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    rowPressed: { backgroundColor: "#1a1b22" },
    avatar: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: AVATAR / 2,
        backgroundColor: "#2a2b33",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    avatarImg: { width: "100%", height: "100%" },
    avatarFallback: { color: "#fff", fontSize: 18, fontWeight: "600" },
    rowBody: { flex: 1 },
    rowName: { color: "#fff", fontSize: 15, fontWeight: "500" },
    rowSub: { color: "#8a8fa7", fontSize: 12, marginTop: 2 },
    sep: { height: 1, backgroundColor: "#16171c", marginLeft: 78 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { color: "#666", fontSize: 14 },
});
