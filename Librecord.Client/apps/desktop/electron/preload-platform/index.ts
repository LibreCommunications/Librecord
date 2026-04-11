/**
 * Per-platform preload dispatcher. The main preload entry point calls
 * this once; the matching OS module installs its contextBridge.
 */

import { exposeLinux }   from "./linux";
import { exposeWindows } from "./win32";
import { exposeDarwin }  from "./darwin";

export function exposePlatformBridges(): void {
    switch (process.platform) {
        case "linux":  exposeLinux();   break;
        case "win32":  exposeWindows(); break;
        case "darwin": exposeDarwin();  break;
    }
}
