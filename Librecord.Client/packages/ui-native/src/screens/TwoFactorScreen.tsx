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
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthContext } from "@librecord/app/context";
import { auth } from "@librecord/api-client";
import type { RootStackParamList } from "../navigation/types.ts";

type Props = NativeStackScreenProps<RootStackParamList, "TwoFactor">;

export function TwoFactorScreen({ navigation, route }: Props) {
    const { sessionToken } = route.params;
    const { loadUser } = useContext(AuthContext);
    const [mode, setMode] = useState<"code" | "recovery">("code");
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isRecovery = mode === "recovery";
    const canSubmit = (isRecovery ? value.length > 0 : value.length === 6) && !busy;

    async function onSubmit() {
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            const res = isRecovery
                ? await auth.verifyTwoFactorRecovery(sessionToken, value.trim())
                : await auth.verifyTwoFactor(sessionToken, value.trim());
            const text = await res.text();
            let body: { success?: boolean; error?: string } | null = null;
            try { body = text ? JSON.parse(text) : null; } catch { /* leave body null */ }

            if (!res.ok || (body && body.success === false)) {
                setError(body?.error || text || "Invalid code");
                setValue("");
                return;
            }
            // Cookies are set by the verify endpoint; populate AuthContext.
            await loadUser();
            navigation.replace("Home");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed");
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
                <Text style={styles.title}>Two-factor auth</Text>
                <Text style={styles.subtitle}>
                    {isRecovery ? "Enter one of your recovery codes" : "Enter the 6-digit code from your authenticator app"}
                </Text>

                <TextInput
                    value={value}
                    onChangeText={(t) => setValue(isRecovery ? t : t.replace(/\D/g, "").slice(0, 6))}
                    placeholder={isRecovery ? "Recovery code" : "000000"}
                    placeholderTextColor="#666"
                    autoCapitalize={isRecovery ? "characters" : "none"}
                    autoCorrect={false}
                    keyboardType={isRecovery ? "default" : "number-pad"}
                    maxLength={isRecovery ? 32 : 6}
                    style={styles.input}
                    autoFocus
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
                    <Text style={styles.buttonText}>{busy ? "Verifying…" : "Verify"}</Text>
                </Pressable>

                {error && <Text style={styles.error}>{error}</Text>}

                <Pressable
                    onPress={() => {
                        setMode(isRecovery ? "code" : "recovery");
                        setValue("");
                        setError(null);
                    }}
                    style={styles.switchBtn}
                >
                    <Text style={styles.switchText}>
                        {isRecovery ? "Use authenticator code instead" : "Use a recovery code instead"}
                    </Text>
                </Pressable>

                <Pressable onPress={() => navigation.replace("Login")} style={styles.switchBtn}>
                    <Text style={styles.switchText}>Cancel</Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b0f" },
    inner: { flex: 1, justifyContent: "center", padding: 24 },
    title: { color: "#fff", fontSize: 28, fontWeight: "600" },
    subtitle: { color: "#888", marginBottom: 32, marginTop: 4 },
    input: {
        backgroundColor: "#16171c",
        color: "#fff",
        borderWidth: 1,
        borderColor: "#2a2b33",
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        fontSize: 18,
        letterSpacing: 2,
    },
    button: {
        backgroundColor: "#5865f2",
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonPressed: { opacity: 0.85 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    error: { color: "#f25856", marginTop: 14, fontSize: 13 },
    switchBtn: { marginTop: 20, alignItems: "center" },
    switchText: { color: "#8a8fa7", fontSize: 13 },
});

// Re-exported for route typing elsewhere.
export type { NativeStackNavigationProp };
