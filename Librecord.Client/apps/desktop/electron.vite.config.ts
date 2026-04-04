import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";
import path from "path";

export default defineConfig({
  envDir: "../../",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            lib: {
              entry: "electron/main.ts",
              formats: ["cjs"],
              fileName: () => "main.cjs",
            },
            rollupOptions: {
              external: ["electron", "electron-updater", "@vencord/venmic", "pkg-prebuilds"],
            },
          },
        },
      },
      preload: {
        input: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
              output: {
                entryFileNames: "preload.cjs",
              },
            },
          },
        },
      },
    }),
  ],
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
  },
});
