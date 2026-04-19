import { useContext } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "@librecord/api-client";
import { AuthContext } from "@librecord/app/context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.ts";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
    const { user, logout } = useContext(AuthContext);
    const avatarSrc = user?.avatarUrl ? `${API_URL}${user.avatarUrl}` : null;
    const initial = (user?.displayName ?? user?.username ?? "?").charAt(0).toUpperCase();

    return (
        <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
                    <Text style={styles.backGlyph}>‹</Text>
                </Pressable>
                <Text style={styles.title}>Settings</Text>
            </View>

            <View style={styles.profile}>
                <View style={styles.avatar}>
                    {avatarSrc
                        ? <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
                        : <Text style={styles.avatarFallback}>{initial}</Text>
                    }
                </View>
                <View style={styles.profileText}>
                    <Text style={styles.name}>{user?.displayName ?? "—"}</Text>
                    <Text style={styles.sub}>@{user?.username ?? ""}</Text>
                    <Text style={styles.sub}>{user?.email ?? ""}</Text>
                </View>
            </View>

            <Pressable onPress={() => logout()} style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}>
                <Text style={styles.logoutText}>Sign out</Text>
            </Pressable>
        </SafeAreaView>
    );
}

const AVATAR = 64;

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
    title: { color: "#fff", fontSize: 17, fontWeight: "600", marginLeft: 4 },

    profile: {
        flexDirection: "row",
        alignItems: "center",
        padding: 20,
        gap: 16,
    },
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
    avatarFallback: { color: "#fff", fontSize: 28, fontWeight: "600" },
    profileText: { flex: 1 },
    name: { color: "#fff", fontSize: 20, fontWeight: "600" },
    sub: { color: "#8a8fa7", fontSize: 13, marginTop: 2 },

    logout: {
        marginHorizontal: 20,
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: "#2a2b33",
        alignItems: "center",
    },
    logoutPressed: { opacity: 0.8 },
    logoutText: { color: "#f25856", fontSize: 15, fontWeight: "600" },
});
