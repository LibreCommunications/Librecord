import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    PermissionsAndroid,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import CookieManager from "@react-native-cookies/cookies";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import RNFS from "react-native-fs";
import { logger } from "@librecord/domain";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types.ts";

type Props = NativeStackScreenProps<RootStackParamList, "Media">;

function originOf(url: string): string {
    try {
        return new URL(url).origin;
    } catch {
        return "";
    }
}

function videoHtml(uri: string): string {
    // Minimal HTML that plays the video with native controls. Chromium's media
    // engine handles buffering/cookies automatically inside the Android
    // WebView, which sidesteps the react-native-video + Fabric surface
    // compositing issues we hit repeatedly.
    return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    html,body{margin:0;padding:0;background:#000;height:100%;width:100%;overflow:hidden;}
    video{display:block;width:100%;height:100%;background:#000;object-fit:contain;}
  </style>
</head>
<body>
  <video src="${uri.replace(/"/g, "&quot;")}" controls autoplay playsinline></video>
</body>
</html>`;
}

async function cookieHeaderFor(url: string): Promise<string | null> {
    try {
        const cookies = await CookieManager.get(url);
        const entries = Object.entries(cookies);
        if (entries.length === 0) return null;
        return entries.map(([name, c]) => `${name}=${c.value}`).join("; ");
    } catch {
        return null;
    }
}

async function ensureWritePermission(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    if ((Platform.Version as number) >= 33) return true;
    const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
            title: "Save to Photos",
            message: "Librecord needs access to save media to your gallery.",
            buttonPositive: "Allow",
        },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function downloadAndSave(uri: string, fileName: string, type: "photo" | "video"): Promise<void> {
    const ok = await ensureWritePermission();
    if (!ok) throw new Error("Permission denied");

    const cookie = await cookieHeaderFor(uri);
    const localPath = `${RNFS.CachesDirectoryPath}/${Date.now()}-${fileName}`;
    const res = await RNFS.downloadFile({
        fromUrl: uri,
        toFile: localPath,
        headers: cookie ? { Cookie: cookie } : {},
    }).promise;
    if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`HTTP ${res.statusCode}`);
    }
    try {
        await CameraRoll.saveAsset(`file://${localPath}`, { type, album: "Librecord" });
    } finally {
        RNFS.unlink(localPath).catch(() => {});
    }
}

export function MediaScreen({ navigation, route }: Props) {
    const target = route.params;
    const { width: sw, height: sh } = useWindowDimensions();
    const [saving, setSaving] = useState(false);

    // WebView uses Android's shared CookieManager, same store as RN's fetch —
    // so cookies flow through automatically. Keeping this hook only for the
    // download path which runs its own HTTP request via RNFS.
    useEffect(() => { cookieHeaderFor(target.uri); }, [target.uri]);

    async function onDownload() {
        setSaving(true);
        try {
            await downloadAndSave(target.uri, target.fileName, target.kind === "video" ? "video" : "photo");
            Alert.alert("Saved", "Saved to your Photos library.");
        } catch (err) {
            Alert.alert("Save failed", err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <View style={styles.topBar}>
                <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
                    <Text style={styles.iconGlyph}>✕</Text>
                </Pressable>
                <Text style={styles.fileName} numberOfLines={1}>{target.fileName}</Text>
                <Pressable onPress={onDownload} hitSlop={12} style={styles.iconBtn} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.iconGlyph}>⬇</Text>}
                </Pressable>
            </View>

            <View style={styles.mediaWrap}>
                {target.kind === "image" ? (
                    <Image
                        source={{ uri: target.uri }}
                        style={{ width: sw, height: sh - 120 }}
                        resizeMode="contain"
                    />
                ) : (
                    <WebView
                        // A `baseUrl` matching the video's origin makes
                        // Chromium treat the HTML string as if served from
                        // that origin, so the subsequent <video src> request
                        // attaches the session cookies from Android's shared
                        // CookieManager. Without it the page is origin-less
                        // and cookies don't flow.
                        source={{ html: videoHtml(target.uri), baseUrl: originOf(target.uri) }}
                        style={{ width: sw, height: sh - 120, backgroundColor: "#000" }}
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled
                        domStorageEnabled
                        thirdPartyCookiesEnabled
                        sharedCookiesEnabled
                        mixedContentMode="compatibility"
                        onError={(e) => logger.ui.warn("webview video error", e.nativeEvent)}
                        onHttpError={(e) => logger.ui.warn("webview http error", e.nativeEvent)}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingTop: 40,
        paddingBottom: 12,
        gap: 8,
    },
    iconBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    iconGlyph: { color: "#fff", fontSize: 18 },
    fileName: { flex: 1, color: "#fff", fontSize: 14 },
    mediaWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    videoError: { padding: 24, alignItems: "center", gap: 8 },
    videoErrorTitle: { color: "#f25856", fontSize: 16, fontWeight: "600" },
    videoErrorText: { color: "#8a8fa7", fontSize: 13, textAlign: "center" },
});
