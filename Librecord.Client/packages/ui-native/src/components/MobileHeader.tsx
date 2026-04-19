import { useContext } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { API_URL } from "@librecord/api-client";
import { AuthContext } from "@librecord/app/context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.ts";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Shared top header — user avatar (with presence dot) on the left, screen
 * title in the middle, settings gear on the right. Rendered inside each tab
 * screen so the content below adjusts freely.
 */
export function MobileHeader({ title }: { title: string }) {
    const { user } = useContext(AuthContext);
    const navigation = useNavigation<Nav>();

    const avatarSrc = user?.avatarUrl ? `${API_URL}${user.avatarUrl}` : null;
    const initial = (user?.displayName ?? user?.username ?? "?").charAt(0).toUpperCase();

    return (
        <View style={styles.root}>
            <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={8} style={styles.avatarWrap}>
                <View style={styles.avatar}>
                    {avatarSrc
                        ? <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
                        : <Text style={styles.avatarFallback}>{initial}</Text>
                    }
                </View>
                {/* Presence dot — hardcoded online for now; wire to useAuth once we track status */}
                <View style={styles.statusDot} />
            </Pressable>

            <Text style={styles.title} numberOfLines={1}>{title}</Text>

            <Pressable
                onPress={() => navigation.navigate("Settings")}
                hitSlop={8}
                style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
            >
                <Text style={styles.gearGlyph}>⚙</Text>
            </Pressable>
        </View>
    );
}

const AVATAR = 32;

const styles = StyleSheet.create({
    root: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#16171c",
    },
    avatarWrap: { width: AVATAR, height: AVATAR },
    avatar: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: AVATAR / 2,
        backgroundColor: "#2a2b33",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    avatarImg: { width: "100%", height: "100%" },
    avatarFallback: { color: "#fff", fontWeight: "600" },
    statusDot: {
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#3ba55d",
        borderWidth: 2,
        borderColor: "#0b0b0f",
    },
    title: {
        flex: 1,
        color: "#fff",
        fontSize: 17,
        fontWeight: "600",
        marginHorizontal: 14,
    },
    gear: { padding: 4 },
    gearPressed: { opacity: 0.6 },
    gearGlyph: { color: "#8a8fa7", fontSize: 22 },
});
