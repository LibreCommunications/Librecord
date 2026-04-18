import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen.tsx";
import { TwoFactorScreen } from "../screens/TwoFactorScreen.tsx";
import { HomeScreen } from "../screens/HomeScreen.tsx";
import type { RootStackParamList } from "./types.ts";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0b0b0f" } }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
    );
}
