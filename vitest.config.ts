import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest does not read `vite.config.js`, so the version constant has to be
 * injected here as well — component tests render the real <App/>, which reads it.
 * Keep in sync with the `define` block in `vite.config.js`.
 */
const { version: appVersion } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: {
      // requestAnimationFrame for useCountUp / chart animations in component tests.
      jsdom: { pretendToBeVisual: true },
    },
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    css: false,
  },
});
