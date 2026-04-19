import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MobileHeader } from "../components/MobileHeader.tsx";

export function FriendsScreen() {
    return (
        <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
            <MobileHeader title="Friends" />
            <View style={styles.body}>
                <Text style={styles.placeholder}>Friends list coming soon.</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b0f" },
    body: { flex: 1, alignItems: "center", justifyContent: "center" },
    placeholder: { color: "#666", fontSize: 14 },
});
