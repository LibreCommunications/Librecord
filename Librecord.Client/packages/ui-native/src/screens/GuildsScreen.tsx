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
import { API_URL, guilds as guildsApi } from "@librecord/api-client";
import { AuthContext } from "@librecord/app/context";
import type { GuildSummary, AppEventMap } from "@librecord/domain";
import { onCustomEvent, onEvent } from "@librecord/app/typedEvent";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MobileHeader } from "../components/MobileHeader.tsx";
import type { RootStackParamList } from "../navigation/types.ts";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GuildsScreen() {
    const { user } = useContext(AuthContext);
    const navigation = useNavigation<Nav>();
    const [servers, setServers] = useState<GuildSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const list = await guildsApi.list();
            setServers(list);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:updated"]>("guild:updated", (d) => {
            setServers((prev) =>
                prev.map((g) =>
                    g.id === d.guildId
                        ? {
                              ...g,
                              ...(d.name !== undefined && { name: d.name }),
                              ...(d.iconUrl !== undefined && {
                                  iconUrl: d.iconUrl ? `${d.iconUrl}?t=${Date.now()}` : null,
                              }),
                          }
                        : g,
                ),
            );
        });
    }, []);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:deleted"]>("guild:deleted", (d) => {
            setServers((prev) => prev.filter((g) => g.id !== d.guildId));
        });
    }, []);

    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:member:removed"]>("guild:member:removed", (d) => {
            if (d.userId !== user?.userId) return;
            setServers((prev) => prev.filter((g) => g.id !== d.guildId));
        });
    }, [user?.userId]);

    useEffect(() => {
        return onEvent("realtime:reconnected", () => { load(); });
    }, [load]);

    return (
        <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
            <MobileHeader title="Guilds" />
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#5865f2" />
                </View>
            ) : (
                <FlatList
                    data={servers}
                    keyExtractor={(g) => g.id}
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
                            <Text style={styles.emptyText}>You're not in any guilds yet.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <GuildRow
                            guild={item}
                            onPress={() => navigation.navigate("Guild", { guildId: item.id, guildName: item.name })}
                        />
                    )}
                    contentContainerStyle={servers.length === 0 ? { flexGrow: 1 } : undefined}
                />
            )}
        </SafeAreaView>
    );
}

function GuildRow({ guild, onPress }: { guild: GuildSummary; onPress: () => void }) {
    const iconSrc = guild.iconUrl ? `${API_URL}${guild.iconUrl}` : null;
    const initial = (guild.name ?? "?").charAt(0).toUpperCase();
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.avatar}>
                {iconSrc
                    ? <Image source={{ uri: iconSrc }} style={styles.avatarImg} />
                    : <Text style={styles.avatarFallback}>{initial}</Text>
                }
            </View>
            <Text style={styles.rowName} numberOfLines={1}>{guild.name}</Text>
        </Pressable>
    );
}

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
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#2a2b33",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    avatarImg: { width: "100%", height: "100%" },
    avatarFallback: { color: "#fff", fontSize: 18, fontWeight: "600" },
    rowName: { color: "#fff", fontSize: 15, flex: 1 },
    sep: { height: 1, backgroundColor: "#16171c", marginLeft: 78 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { color: "#666", fontSize: 14 },
});
