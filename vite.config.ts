import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths keep the app deployable at a GitHub Pages root or subpath.
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: true,
    // Keep the core shell lean; feature-level dynamic imports define future chunks.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    clearMocks: true,
  },
});