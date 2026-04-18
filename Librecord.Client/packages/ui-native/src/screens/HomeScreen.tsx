import { useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthContext } from "@librecord/app/context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.ts";

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

export function HomeScreen({ navigation }: Props) {
    const { user, logout } = useContext(AuthContext);

    async function onLogout() {
        await logout();
        navigation.replace("Login");
    }

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.inner}>
                <Text style={styles.title}>Welcome{user ? `, ${user.displayName}` : ""}</Text>
                {user && (
                    <>
                        <Text style={styles.line}>@{user.username}</Text>
                        <Text style={styles.line}>{user.email}</Text>
                        {user.guilds && <Text style={styles.line}>{user.guilds.length} server(s)</Text>}
                    </>
                )}
                <Pressable onPress={onLogout} style={styles.button}>
                    <Text style={styles.buttonText}>Sign out</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b0f" },
    inner: { flex: 1, padding: 24 },
    title: { color: "#fff", fontSize: 24, fontWeight: "600", marginBottom: 12 },
    line: { color: "#aaa", fontSize: 14, marginBottom: 4 },
    button: {
        backgroundColor: "#2a2b33",
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 32,
    },
    buttonText: { color: "#fff", fontSize: 15, fontWeight: "500" },
});
