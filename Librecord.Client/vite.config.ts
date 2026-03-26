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

function versionPlugin(): import("vite").Plugin {
  const buildId = Date.now().toString(36);
  return {
    name: "version-json",
    // `config` runs before env resolution — `define` injects the value
    // so import.meta.env.VITE_BUILD_ID is available in client code
    config() {
      return {
        define: {
          "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
        },
      };
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId }),
      });
    },
  };
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
