import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const backend = process.env.LITVERSE_BACKEND ?? "http://127.0.0.1:8010";

export default defineConfig({
  plugins: [react()],
  // Phaser 묶음(약 1.4MB)은 탐험 화면에서만 따로 불러온다
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
