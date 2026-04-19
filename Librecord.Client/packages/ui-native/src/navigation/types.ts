import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
    Guilds: undefined;
    Dms: undefined;
    Friends: undefined;
};

export type MediaTarget = {
    kind: "image" | "video";
    uri: string;
    fileName: string;
    width?: number | null;
    height?: number | null;
};

export type RootStackParamList = {
    Login: undefined;
    TwoFactor: { sessionToken: string };
    MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
    Guild: { guildId: string; guildName: string };
    Channel: { channelId: string; channelName: string };
    DmChannel: { channelId: string; title: string };
    Settings: undefined;
    Media: MediaTarget;
};
