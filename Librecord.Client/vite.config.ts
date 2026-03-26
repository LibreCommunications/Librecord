import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

function getHttpsConfig() {
  const keyPath = path.resolve(process.env.HOME!, ".aspnet/https/localhost-key.pem");
  const certPath = path.resolve(process.env.HOME!, ".aspnet/https/localhost.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }
  return undefined;
}

function versionPlugin() {
  const buildId = Date.now().toString(36);
  return {
    name: "version-json",
    buildStart() {
      // Expose to client code via import.meta.env
      process.env.VITE_BUILD_ID = buildId;
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId }),
      });
    },
  } satisfies import("vite").Plugin;
}

export default defineConfig({
  server: {
    https: getHttpsConfig(),
    host: "localhost",
    port: 5173,
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    versionPlugin(),
  ],
});
