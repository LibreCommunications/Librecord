import { StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { GuildsScreen } from "../screens/GuildsScreen.tsx";
import { DmsScreen } from "../screens/DmsScreen.tsx";
import { FriendsScreen } from "../screens/FriendsScreen.tsx";
import type { MainTabParamList } from "./types.ts";

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
    return (
        <View style={styles.tabIconWrap}>
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{glyph}</Text>
        </View>
    );
}

export function MainTabs() {
    return (
        <Tab.Navigator
            initialRouteName="Guilds"
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: "#fff",
                tabBarInactiveTintColor: "#8a8fa7",
                tabBarLabelStyle: styles.tabLabel,
            }}
        >
            <Tab.Screen
                name="Guilds"
                component={GuildsScreen}
                options={{
                    tabBarLabel: "Guilds",
                    tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Dms"
                component={DmsScreen}
                options={{
                    tabBarLabel: "DMs",
                    tabBarIcon: ({ focused }) => <TabIcon glyph="💬" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Friends"
                component={FriendsScreen}
                options={{
                    tabBarLabel: "Friends",
                    tabBarIcon: ({ focused }) => <TabIcon glyph="👥" focused={focused} />,
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: "#0b0b0f",
        borderTopColor: "#16171c",
        borderTopWidth: 1,
        // No fixed height — let @react-navigation/bottom-tabs grow the bar
        // above the Android gesture bar via its safe-area handling.
        paddingTop: 6,
    },
    tabLabel: { fontSize: 11, fontWeight: "500" },
    tabIconWrap: { alignItems: "center", justifyContent: "center" },
    tabIcon: { fontSize: 20, opacity: 0.7 },
    tabIconActive: { opacity: 1 },
});
