import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { guilds as guildsApi } from "@librecord/api-client";
import { onCustomEvent, onEvent } from "@librecord/app/typedEvent";
import type { GuildChannel, AppEventMap } from "@librecord/domain";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.ts";

const CH_VOICE = 1;
const CH_CATEGORY = 2;

type Props = NativeStackScreenProps<RootStackParamList, "Guild">;

type Row =
    | { kind: "category"; id: string; name: string }
    | { kind: "channel"; channel: GuildChannel };

/**
 * Group a flat GuildChannel[] into the ordered rows we want to render:
 * categories sorted by position, with their children under them, and
 * any parent-less non-category channels at the very top under a virtual
 * "no category" header.
 */
function buildRows(channels: GuildChannel[]): Row[] {
    const byPos = (a: GuildChannel, b: GuildChannel) => (a.position ?? 0) - (b.position ?? 0);
    const categories = channels.filter((c) => c.type === CH_CATEGORY).sort(byPos);
    const orphanChannels = channels
        .filter((c) => c.type !== CH_CATEGORY && !c.parentId)
        .sort(byPos);

    const rows: Row[] = [];
    for (const c of orphanChannels) rows.push({ kind: "channel", channel: c });

    for (const cat of categories) {
        rows.push({ kind: "category", id: cat.id, name: cat.name });
        const kids = channels
            .filter((c) => c.type !== CH_CATEGORY && c.parentId === cat.id)
            .sort(byPos);
        for (const c of kids) rows.push({ kind: "channel", channel: c });
    }
    return rows;
}

export function GuildScreen({ navigation, route }: Props) {
    const { guildId, guildName } = route.params;
    const [channels, setChannels] = useState<GuildChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const list = await guildsApi.channels(guildId);
            setChannels(list);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [guildId]);

    useEffect(() => { load(); }, [load]);

    // Live channel events — mirror the subscriptions web's ChannelSidebar relies on.
    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:channel:created"]>("guild:channel:created", (d) => {
            if (d.guildId !== guildId) return;
            // Refetch to pick up full channel shape (event payload is minimal).
            load();
        });
    }, [guildId, load]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:channel:updated"]>("guild:channel:updated", (d) => {
            if (d.guildId !== guildId) return;
            setChannels((prev) =>
                prev.map((c) =>
                    c.id === d.channelId
                        ? { ...c, name: d.name, ...(d.topic !== undefined && { topic: d.topic }), ...(d.parentId !== undefined && { parentId: d.parentId }) }
                        : c,
                ),
            );
        });
    }, [guildId]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:channel:deleted"]>("guild:channel:deleted", (d) => {
            if (d.guildId !== guildId) return;
            setChannels((prev) => prev.filter((c) => c.id !== d.channelId));
        });
    }, [guildId]);

    // If the guild itself is deleted, pop back to the servers list.
    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:deleted"]>("guild:deleted", (d) => {
            if (d.guildId === guildId) navigation.popToTop();
        });
    }, [guildId, navigation]);

    useEffect(() => {
        return onEvent("realtime:reconnected", () => { load(); });
    }, [load]);

    const rows = useMemo(() => buildRows(channels), [channels]);

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
                    <Text style={styles.backGlyph}>‹</Text>
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={styles.title} numberOfLines={1}>{guildName}</Text>
                    <Text style={styles.subtitle}>
                        {channels.filter((c) => c.type !== CH_CATEGORY).length} channels
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#5865f2" />
                </View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(r) => (r.kind === "category" ? `cat:${r.id}` : `ch:${r.channel.id}`)}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            tintColor="#5865f2"
                            onRefresh={() => { setRefreshing(true); load(); }}
                        />
                    }
                    renderItem={({ item }) =>
                        item.kind === "category"
                            ? <CategoryHeader name={item.name} />
                            : <ChannelRow
                                channel={item.channel}
                                onPress={() => {
                                    if (item.channel.type === CH_VOICE) return; // voice join comes later
                                    navigation.navigate("Channel", {
                                        channelId: item.channel.id,
                                        channelName: item.channel.name,
                                    });
                                }}
                            />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No channels visible.</Text>
                        </View>
                    }
                    contentContainerStyle={rows.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24 }}
                />
            )}
        </SafeAreaView>
    );
}

function CategoryHeader({ name }: { name: string }) {
    return (
        <Text style={styles.categoryHeader}>{name.toUpperCase()}</Text>
    );
}

function ChannelRow({ channel, onPress }: { channel: GuildChannel; onPress: () => void }) {
    const glyph = channel.type === CH_VOICE ? "🔊" : "#";
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Text style={styles.rowGlyph}>{glyph}</Text>
            <Text style={styles.rowName} numberOfLines={1}>{channel.name}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b0f" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#16171c",
    },
    back: { paddingHorizontal: 8, paddingVertical: 4 },
    backGlyph: { color: "#8a8fa7", fontSize: 32, lineHeight: 32 },
    headerText: { flex: 1, marginLeft: 4 },
    title: { color: "#fff", fontSize: 20, fontWeight: "600" },
    subtitle: { color: "#8a8fa7", fontSize: 12, marginTop: 2 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    categoryHeader: {
        color: "#8a8fa7",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 6,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    rowPressed: { backgroundColor: "#1a1b22" },
    rowGlyph: { color: "#8a8fa7", fontSize: 16, width: 22, textAlign: "center" },
    rowName: { color: "#fff", fontSize: 15, flex: 1, marginLeft: 6 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { color: "#666", fontSize: 14 },
});
