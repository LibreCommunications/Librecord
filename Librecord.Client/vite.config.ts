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
  ],
});
