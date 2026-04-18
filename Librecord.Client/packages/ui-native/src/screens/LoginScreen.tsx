import { useContext, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthContext } from "@librecord/app/context";
import type { RootStackParamList } from "../navigation/types.ts";

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, "Login">;
};

export function LoginScreen({ navigation }: Props) {
    const { login } = useContext(AuthContext);
    const [emailOrUsername, setEmailOrUsername] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = emailOrUsername.length > 0 && password.length > 0 && !busy;

    async function onSubmit() {
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            const result = await login(emailOrUsername, password);
            if (result.error) {
                setError(result.error);
                return;
            }
            if (result.requiresTwoFactor && result.twoFactorSessionToken) {
                navigation.replace("TwoFactor", { sessionToken: result.twoFactorSessionToken });
                return;
            }
            navigation.replace("Home");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.inner}>
                <Text style={styles.title}>Sign in</Text>
                <Text style={styles.subtitle}>Librecord</Text>

                <TextInput
                    value={emailOrUsername}
                    onChangeText={setEmailOrUsername}
                    placeholder="Email or username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.input}
                />
                <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#666"
                    secureTextEntry
                    style={styles.input}
                />

                <Pressable
                    onPress={onSubmit}
                    disabled={!canSubmit}
                    style={({ pressed }) => [
                        styles.button,
                        !canSubmit && styles.buttonDisabled,
                        pressed && styles.buttonPressed,
                    ]}
                >
                    <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in"}</Text>
                </Pressable>
                {error && <Text style={styles.error}>{error}</Text>}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#0b0b0f",
    },
    inner: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
    },
    title: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "600",
    },
    subtitle: {
        color: "#888",
        marginBottom: 32,
    },
    input: {
        backgroundColor: "#16171c",
        color: "#fff",
        borderWidth: 1,
        borderColor: "#2a2b33",
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        fontSize: 16,
    },
    button: {
        backgroundColor: "#5865f2",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    error: {
        color: "#f25856",
        marginTop: 14,
        fontSize: 13,
    },
});
