import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so the built app works at a domain root AND under a sub-path
  // (e.g. a GitHub Pages project site). The PWA metadata is already relative —
  // manifest start_url/scope "./", and the worker is registered as "./sw.js" —
  // so an absolute "/assets/*" base would 404 under a sub-path and render a
  // blank page. See README "Deploying".
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
