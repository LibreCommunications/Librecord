import { useContext } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthContext } from "@librecord/app/context";
import { LoginScreen } from "../screens/LoginScreen.tsx";
import { TwoFactorScreen } from "../screens/TwoFactorScreen.tsx";
import { GuildScreen } from "../screens/GuildScreen.tsx";
import { ChannelScreen } from "../screens/ChannelScreen.tsx";
import { DmChannelScreen } from "../screens/DmChannelScreen.tsx";
import { SettingsScreen } from "../screens/SettingsScreen.tsx";
import { MediaScreen } from "../screens/MediaScreen.tsx";
import { MainTabs } from "./MainTabs.tsx";
import type { RootStackParamList } from "./types.ts";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth-aware root navigator. When AuthContext resolves a user the root stack
 * swaps to the app stack (MainTabs + detail screens). When user goes null
 * (logout), we swap back to the auth stack.
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
                <>
                    <Stack.Screen name="MainTabs" component={MainTabs} />
                    <Stack.Screen name="Guild" component={GuildScreen} />
                    <Stack.Screen name="Channel" component={ChannelScreen} />
                    <Stack.Screen name="DmChannel" component={DmChannelScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen
                        name="Media"
                        component={MediaScreen}
                        options={{ contentStyle: { backgroundColor: "#000" }, animation: "fade" }}
                    />
                </>
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
