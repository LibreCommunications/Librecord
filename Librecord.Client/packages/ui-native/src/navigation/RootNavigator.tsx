import { useContext } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthContext } from "@librecord/app/context";
import { LoginScreen } from "../screens/LoginScreen.tsx";
import { TwoFactorScreen } from "../screens/TwoFactorScreen.tsx";
import { ServersScreen } from "../screens/ServersScreen.tsx";
import type { RootStackParamList } from "./types.ts";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Splits the stack by auth state. When AuthProvider resolves a user (from its
 * /users/me bootstrap that relies on persistent HttpOnly cookies), we swap to
 * the app stack automatically — no explicit navigation.replace needed in the
 * login flow. When logout fires, user goes null and we swap back.
 */
export function RootNavigator() {
    const { user, authLoading } = useContext(AuthContext);

    if (authLoading) {
        return (
            <View style={styles.splash}>
                <ActivityIndicator color="#5865f2" />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0b0b0f" } }}>
            {user ? (
                <Stack.Screen name="Servers" component={ServersScreen} />
            ) : (
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}

const styles = StyleSheet.create({
    splash: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0b0b0f" },
});
