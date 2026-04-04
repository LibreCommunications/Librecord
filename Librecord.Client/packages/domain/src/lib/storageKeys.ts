// Centralized localStorage / sessionStorage key constants.
// All keys use the "lr:" prefix for consistency.

export const STORAGE = {
    // Voice
    devicePrefs: "lr:device-prefs",
    userVolumes: "lr:user-volumes",
    noiseSuppression: "lr:noise-suppression",
    voiceSession: "lr:voice-session",
    voicePrefs: "lr:voice-prefs",

    // App settings
    desktopNotifs: "lr:desktop-notifs",
    notifSounds: "lr:notif-sounds",
    devMode: "lr:dev-mode",
    showDmProfile: "lr:show-dm-profile",
    apiUrl: "lr:api-url",

    // Navigation
    lastVisited: "lr:last-visited",
    guildFolders: "lr:guild-folders",
    expandedFolders: "lr:expanded-folders",

    // Session (sessionStorage)
    returnUrl: "lr:return-url",
} as const;
